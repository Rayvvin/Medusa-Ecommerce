// import { Request, Response } from "express";
// import { MedusaRequest } from "@medusajs/medusa";
// import nodemailer from "nodemailer";
// import path from "path";
// import pug from "pug";
// import OrderService from "src/services/order";


// export default async (req: MedusaRequest, res: Response): Promise<void> => {
//   const { id } = req.body;

//   if (!id) {
//     res.status(400).json({ message: "Missing 'id' in request body" });
//     return 
//   }

//   const orderService = req.scope.resolve<OrderService>("orderService");

//   let order;
//   try {
//     order = await orderService.retrieve(id, {
//       relations: ["customer", "items", "shipping_address", "billing_address"],
//     });
//   } catch (error) {
//     res.status(404).json({ message: `Order with ID ${id} not found` });
//     return 
//   }

//   // 🔧 Setup nodemailer transporter
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: parseInt(process.env.SMTP_PORT || "587"),
//     secure: false,
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//   });

//   // 📁 Use Medusa-like template path structure
//   const templateName = "orderPlaced"; // based on templateMap["order.placed"]
//   const templateFile = path.join(__dirname, `../../data/emailTemplates/${templateName}/html.pug`);

//   let html;
//   try {
//     html = pug.renderFile(templateFile, {
//       order,
//       display_id: order.display_id,
//       email: order.email,
//       currency: order.currency_code,
//       total: (order.total / 100).toFixed(2),
//     });
//   } catch (err) {
//     console.error("Template render error:", err);
//     res.status(500).json({ message: "Email template rendering failed" });
//     return 
//   }

//   // 📬 Send the email
//   try {
//     await transporter.sendMail({
//       from: `"Rayvvin Store" <${process.env.SMTP_USER}>`,
//       to: order.email,
//       subject: `Order Confirmation - #${order.display_id}`,
//       html,
//     });

//     res.status(200).json({ message: `Email sent to ${order.email}` });
//   } catch (err) {
//     console.error("Email send error:", err);
//     res.status(500).json({ message: "Failed to send email" });
//   }
// };
