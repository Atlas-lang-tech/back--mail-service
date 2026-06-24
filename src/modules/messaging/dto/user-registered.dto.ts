import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

/** Payload of the `user.registered` event. */
export class UserRegisteredDto {
  @IsUUID()
  eventId: string;

  @IsString()
  userId: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  verificationToken: string;
}
