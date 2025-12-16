import { Lifetime } from "awilix";
import {
  OrderService as MedusaOrderService,
  Order,
  User,
  FindConfig,
  Selector,
} from "@medusajs/medusa";

class OrderService extends MedusaOrderService {
  static LIFE_TIME = Lifetime.SCOPED;
  protected readonly loggedInUser_: User | null;
  container: any;

  constructor(container, options) {
    // @ts-expect-error prefer-rest-params
    super(...arguments);

    try {
      this.loggedInUser_ = container.loggedInUser;
      this.container = container;
    } catch (e) {
      // avoid errors when the backend first runs
    }
  }

  async retrieve(orderId: string, config?: FindConfig<Order>): Promise<Order> {
    // console.log(
    //   "OrderService retrieve called with orderId:",
    //   orderId,
    //   "and config:",
    //   config
    // );

    if (this.loggedInUser_) {
      if (config.relations.includes("fulfillments")) {
        // console.log("Config relations include fulfillments");
        // config.select = [...(config.select || []), "store_id", "region_id"];
        config.relations.push("store");
        // config.select.push("store_id");
      } else {
        config.relations = [...(config.relations || []), "store", "region"];
        config.select = [...(config.select || []), "store_id", "region_id"];
      }
    }

    let order = await super.retrieve(orderId, config);

    // Only set store_id if it's not already present and order.store.id exists
    if (
      (order.store_id === null || order.store_id === undefined) &&
      this.loggedInUser_ &&
      this.loggedInUser_.store_id &&
      order.store &&
      order.store.id
    ) {
      order.store_id = order.store.id;
    }

    if (
      this.loggedInUser_ &&
      this.loggedInUser_?.store_id &&
      (!order.store_id || order.store_id !== this.loggedInUser_.store_id)
    ) {
      // Check if any of the order items belong to the user's store
      const hasStoreProduct = order.items?.some(
        (item) => item.variant.product?.store_id === this.loggedInUser_.store_id
      );

      if (hasStoreProduct) {
        return order;
      }

      // Throw error if you don't want an order to be accessible to other stores
      throw new Error("Order does not exist in store.");
    }

    return order;
  }

  async list(
    selector: Selector<Order>,
    config?: FindConfig<Order>
  ): Promise<Order[]> {
    // Your existing logic for listing orders
    if (this.loggedInUser_ && this.loggedInUser_.store_id) {
      selector["store_id"] = this.loggedInUser_.store_id;
    }

    config.select.push("store_id");

    config.relations = config.relations ?? [];
    config.relations.push("children", "parent", "store");

    return await super.list(selector, config);
  }

  async listAndCount(
    selector: Selector<Order>,
    config?: FindConfig<Order>
  ): Promise<[Order[], number]> {
    // Your existing logic for listing orders
    if (this.loggedInUser_ && this.loggedInUser_.store_id) {
      selector["store_id"] = this.loggedInUser_.store_id;
    }

    config.select.push("store_id");

    config.relations = config.relations ?? [];
    config.relations.push("children", "parent", "store");

    return await super.listAndCount(selector, config);
  }
}

export default OrderService;
