import {
  AbstractFulfillmentService,
  Address,
  Cart,
  Fulfillment,
  FulfillmentItem,
  FulfillmentProvider,
  FulfillmentService,
  LineItem,
  MedusaContainer,
  Order,
} from "@medusajs/medusa";

import { getDistance } from "geolib";
import fetch from "node-fetch";
import shippingRules from "../constants/shipping-rules.json";
import StoreRepository from "src/repositories/store";
import { CreateReturnType } from "@medusajs/medusa/dist/types/fulfillment-provider";
import OrderService from "./order";
import OrderRepository from "src/repositories/order";
import FulfillmentRepository from "@medusajs/medusa/dist/repositories/fulfillment";

type GeoLocation = {
  lat: number;
  lon: number;
  city: string;
};

interface ShippingRule {
  location: string;
  transport_type: string;
  base_fare: number;
  distance_cost: number;
  weight_cost: number;
  speed_multiplier?: Record<string, number>;
  zone_modifiers?: Partial<Record<string, number>>;
}

const buildFulfillmentItems = (items: LineItem[]): FulfillmentItem[] => {
  return items.map((item) => ({
    item_id: item.id, // LineItem ID
    quantity: item.quantity, // Quantity to fulfill
    fulfillment_id: "", // This will be populated later (could be empty)
    fulfillment: null, // Will be populated later (link to fulfillment)
    item: item,
  }));
};


class CustomManualFulfillmentService extends AbstractFulfillmentService {
  static identifier = "custom-fulfillment-manual";

  constructor(container, options) {
    super(container);
  }

  async calculatePrice(
    optionData: any,
    data: any,
    cart: Cart
  ): Promise<number> {
    console.log("Calling this MFR");
    const enrichedAddress = await this.ensureGeoLocation(data.address);
    console.log("Calling this MFR", enrichedAddress);
    const itemsByVendor: Record<string, LineItem[]> = {};
    for (const item of cart.items) {
      const storeId = item.metadata?.store_id;
      if (!storeId || typeof storeId !== "string") continue;
      if (!itemsByVendor[storeId]) {
        itemsByVendor[storeId] = [];
      }
      itemsByVendor[storeId].push(item);
    }

    console.log("Calling this MFR", itemsByVendor);

    let totalCost = 0;

    for (const [storeId, items] of Object.entries(itemsByVendor)) {
      const vendorLocation = await this.getVendorGeo(storeId);

      if (
        !vendorLocation ||
        !enrichedAddress?.metadata?.lat ||
        !enrichedAddress?.metadata?.lon
      ) {
        continue;
      }

      const zone =
        typeof optionData?.data?.zone === "string"
          ? optionData.data.zone
          : this.determineZone(enrichedAddress.city || "");

      const method = (optionData?.name || "standard").toLowerCase();
      const transportType =
        typeof optionData?.data?.transport_type === "string"
          ? optionData.data.transport_type
          : "bike";

      const cost = this.calculateDynamicShippingCost({
        vendor: vendorLocation,
        customer: {
          lat: enrichedAddress.metadata.lat as number,
          lon: enrichedAddress.metadata.lon as number,
          city: enrichedAddress.city || "Unknown",
        },
        items,
        method,
        transportType,
        zone,
      });

      totalCost += cost;
    }

    return Math.round(totalCost * 100); // amount in smallest currency unit
  }

  async ensureGeoLocation(address: Address): Promise<Address> {
    console.log("Calling this nw");
    if (address?.metadata?.lat && address?.metadata?.lon) return address;
    console.log("Calling this guy");
    const query = `${address.address_1}, ${address.city}, ${
      address.postal_code || ""
    }, ${address.country_code}`;

    console.log(query);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}`,
        { headers: { "User-Agent": "medusa-server" } }
      );

      const data = await res.json();
      if (!data[0]) return address;

      address.metadata = {
        ...address.metadata,
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };

      return address;
    } catch (e: any) {
      console.warn("Geo API error:", e.message);
      return address;
    }
  }

  async getVendorGeo(storeId?: string): Promise<GeoLocation | null> {
    if (!storeId) return null;

    try {
      const storeRepo = this.container
        .storeRepository as typeof StoreRepository;
      const store = await storeRepo.findOne({ where: { id: storeId } });

      if (store?.metadata?.lat && store?.metadata?.lon) {
        return {
          lat: Number(store.metadata.lat),
          lon: Number(store.metadata.lon),
          city:
            typeof store.metadata.city === "string"
              ? store.metadata.city
              : "Unknown",
        };
      }

      if (!store.metadata.address_1 || !store.metadata.city) return null;

      const query = `${store.metadata.address_1}, ${store.metadata.city}, ${
        store.metadata.postal_code || ""
      }, ${store.metadata.country_code || ""}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}`,
        { headers: { "User-Agent": "medusa-server" } }
      );

      const data = await res.json();
      if (!data[0]) return null;

      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        city:
          typeof store.metadata.city === "string"
            ? store.metadata.city
            : "Unknown",
      };
    } catch (e: any) {
      console.warn("Vendor geo lookup failed:", e.message);
      return null;
    }
  }

  determineZone(city = ""): string {
    const lc = city.toLowerCase();
    if (lc.includes("central")) return "central";
    if (lc.includes("urban")) return "urban";
    if (lc.includes("suburb")) return "suburban";
    if (lc.includes("rural")) return "rural";
    return "outer";
  }

  calculateDynamicShippingCost({
    vendor,
    customer,
    items,
    method,
    transportType,
    zone,
  }: {
    vendor: GeoLocation;
    customer: GeoLocation;
    items: LineItem[];
    method: string;
    transportType: string;
    zone: string;
  }): number {
    const rule: ShippingRule | undefined = shippingRules.find(
      (r) =>
        r.location.toLowerCase() === vendor.city.toLowerCase() &&
        r.transport_type === transportType
    );

    if (!rule) return 0;

    const distanceKm =
      getDistance(
        { latitude: vendor.lat, longitude: vendor.lon },
        { latitude: customer.lat, longitude: customer.lon }
      ) / 1000;

    const totalWeight = items.reduce(
      (sum, i) => sum + (i.variant?.weight || 1),
      0
    );

    let cost = rule.base_fare;
    cost += rule.distance_cost * distanceKm;
    cost += rule.weight_cost * totalWeight;

    if (zone && rule.zone_modifiers?.[zone]) {
      cost += rule.zone_modifiers[zone];
    }

    const speedMultiplier = rule.speed_multiplier?.[method] || 1;

    return parseFloat((cost * speedMultiplier).toFixed(2));
  }

  async getFulfillmentOptions() {
    return [
      {
        id: "custom-fulfillment-manual",
      },
      {
        id: "custom-fulfillment-manual-return",
        is_return: true,
      },
    ];
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    cart: Cart
  ): Promise<Record<string, unknown>> {
    if (
      [
        "custom-fulfillment-manual",
        "custom-fulfillment-manual-return",
      ].includes(data.id as string)
    ) {
      throw new Error("invalid data");
    }

    return {
      ...data,
    };
  }

  async validateOption() {
    return true;
  }

  async canCalculate() {
    return true;
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: LineItem[],
    order: Order,
    fulfillment: Fulfillment
  ) {
    const fulfillmentService = this.container
      .fulfillmentService as FulfillmentService;
    const orderRepo = this.container.orderRepository as typeof OrderRepository;

    const isChildOrder =
      order.metadata?.type === "childOrder" && order.metadata?.parent;

    if (isChildOrder) {
      const parentOrderId = order.metadata.parent as string;

      // Fetch parent order with related items and fulfillments
      const parentOrder = await orderRepo.findOne({
        where: { id: parentOrderId },
        relations: ["items", "fulfillments", "shipping_methods"],
      });

      // Filter items from the parent that match the child order items
      const parentItemsToFulfill = parentOrder.items.filter((item) =>
        items.some((childItem) => childItem.variant_id === item.variant_id)
      );

      // Extract the shipping method from the parent order
      const shippingMethod = parentOrder.shipping_methods?.[0]; // Select first shipping method (or your logic)

      // Prepare shipping method data
      const shippingMethodData = {
        shipping_method: shippingMethod?.id, // Ensure it's a valid shipping method ID
      };

      // Create a new Fulfillment instance (this invokes any private methods like `beforeInsert`)
      const newFulfillment = new Fulfillment();

      // Manually set the properties on the Fulfillment instance
      newFulfillment.order_id = order.id; // Set order ID
      newFulfillment.items = buildFulfillmentItems(parentItemsToFulfill); // Set fulfillment items
      newFulfillment.metadata = {
        linked_child_order_id: order.id,
        linked_child_fulfillment_id: fulfillment.id,
      };
      newFulfillment.claim_order_id = null; // Set to null or default if not needed
      newFulfillment.claim_order = null; // Same as above
      newFulfillment.swap_id = null; // Same as above
      newFulfillment.swap = null; // Same as above
      //   newFulfillment.status = "pending"; // Or set the appropriate default status
      newFulfillment.updated_at = new Date(); // Set the updated_at timestamp

      // Create the fulfillment for the parent order
      const parentFulfillment = await fulfillmentService.createFulfillment(
        shippingMethodData, // Shipping method data
        parentItemsToFulfill, // Fulfillment items (mapped from parent items)
        parentOrder, // Parent order
        newFulfillment // Full Fulfillment object (created instance)
      );

      // Sync metadata for both child and parent fulfillments
      await this.updateFulfillmentMetadata(fulfillment.id, {
        linked_parent_fulfillment_id: parentFulfillment.id,
        linked_parent_order_id: parentOrderId,
      });

      await this.updateFulfillmentMetadata(parentFulfillment.id as string, {
        linked_child_fulfillment_id: fulfillment.id,
        linked_child_order_id: order.id,
      });
    }

    return {}; // Return empty object as no specific value is expected
  }

  private async updateFulfillmentMetadata(
    fulfillmentId: string,
    metadata: Record<string, any>
  ) {
    const fulfillmentRepo = this.container
      .fulfillmentRepository as typeof FulfillmentRepository;
    const fulfillment = await fulfillmentRepo.findOne({
      where: { id: fulfillmentId },
    });

    if (fulfillment) {
      fulfillment.metadata = {
        ...(fulfillment.metadata || {}),
        ...metadata,
      };
      await fulfillmentRepo.save(fulfillment);
    }
  }

  async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<any> {
    const fulfillmentService = this.container
      .fulfillmentService as FulfillmentService;

    const metadata = fulfillment.metadata as Record<string, any> | undefined;

    if (metadata?.linked_parent_fulfillment_id) {
      try {
        await fulfillmentService.cancelFulfillment(
          metadata.linked_parent_fulfillment_id
        );
      } catch (err) {
        console.warn(
          `Failed to cancel linked parent fulfillment ${metadata.linked_parent_fulfillment_id}:`,
          err
        );
      }
    }

    if (metadata?.linked_child_fulfillment_id) {
      try {
        await fulfillmentService.cancelFulfillment(
          metadata.linked_child_fulfillment_id
        );
      } catch (err) {
        console.warn(
          `Failed to cancel linked child fulfillment ${metadata.linked_child_fulfillment_id}:`,
          err
        );
      }
    }

    return {};
  }

  async createReturn(
    returnOrder: CreateReturnType
  ): Promise<Record<string, unknown>> {
    return {};
  }

  async getTrackingLinks() {
    return [];
  }

  async getFulfillmentDocuments(data: Record<string, unknown>): Promise<any> {
    // assuming you contact a client to
    // retrieve the document
    return [];
  }

  async getReturnDocuments(data: Record<string, unknown>): Promise<any> {
    // assuming you contact a client to
    // retrieve the document
    return [];
  }

  async getShipmentDocuments(data: Record<string, unknown>): Promise<any> {
    // assuming you contact a client to
    // retrieve the document
    return [];
  }

  async retrieveDocuments(
    fulfillmentData: Record<string, unknown>,
    documentType: "invoice" | "label"
  ): Promise<any> {
    // assuming you contact a client to
    // retrieve the document
    return [];
  }
}

export default CustomManualFulfillmentService;
