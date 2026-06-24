import { IsEmail, IsNumber, IsString, IsUUID } from 'class-validator';

/** Payload of the `billing.payment_succeeded` event. */
export class PaymentSucceededDto {
  @IsUUID()
  eventId: string;

  @IsString()
  userId: string;

  @IsEmail()
  email: string;

  /** Charged amount in major units (e.g. 19.99). */
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  invoiceNumber: string;

  @IsString()
  paidAt: string;
}
