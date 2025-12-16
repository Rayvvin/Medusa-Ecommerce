import { Response } from "express";
import { MedusaRequest } from "@medusajs/medusa";
import { NotificationService } from "@medusajs/medusa";
import OrderService from "src/services/order";



export default async (req: MedusaRequest, res: Response): Promise<void> => {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ message: "Missing 'id' in request body" });
    return;
  }

  const orderService = req.scope.resolve<OrderService>("orderService");
  const notificationService = req.scope.resolve<NotificationService>(
    "notificationService"
  );

  let order;
  try {
    order = await orderService.retrieve(id, {
      relations: [
        "items",
        "items.variant",
        "cart",
        "shipping_methods",
        "payments",
        "customer",
      ],
      select: [
        "id",
        "customer",
        "shipping_address",
        "billing_address",
        "shipping_methods",
        "items",
        "cart",
      ],
    });
    order = {
      ...order, customer: { ...order.customer, email: "emmytheo7@gmail.com" },
    };
  } catch (err) {
    res.status(404).json({ message: `Order with ID ${id} not found` });
    return;
  }

  const providerId = "smtp"; // your configured provider
  const eventName = "order.placed";

  console.log(order);
  await notificationService.send(
    eventName,
    {
      to: order.customer.email,
      ...order,  
      resource_type: "order",
      resource_id: order.id,
      customer_id: order.customer.id,
    },
    providerId
  );

  res.status(200).json({
    message: `Re-sent order confirmation to ${order.customer.email} using ${providerId}`,
  });
};
