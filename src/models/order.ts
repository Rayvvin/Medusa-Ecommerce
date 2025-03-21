import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Order as MedusaOrder } from "@medusajs/medusa";
import { Store } from "./store";

@Entity()
export class Order extends MedusaOrder {
  @Index("OrderStoreId")
  @Column({ nullable: true })
  store_id: string;

  @Index("OrderParentId")
  @Column({ nullable: false })
  order_parent_id: string;

  @ManyToOne(() => Store, (store) => store.orders)
  @JoinColumn({ name: "store_id" })
  store: Store;

  @ManyToOne(() => Order, (order) => order.children)
  @JoinColumn({ name: "order_parent_id" })
  parent: Order;

  @OneToMany(() => Order, (order) => order.parent)
  @JoinColumn({ name: "order_parent_id", referencedColumnName: "id" })
  children: Order[];
  id: string;
}
