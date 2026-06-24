import { IsEmail, IsString, IsUUID } from 'class-validator';

/** Payload of the `password.reset_requested` event. */
export class PasswordResetRequestedDto {
  @IsUUID()
  eventId: string;

  @IsString()
  userId: string;

  @IsEmail()
  email: string;

  @IsString()
  resetToken: string;
}
