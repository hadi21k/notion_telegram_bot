import User from "./user.types";

type Token = {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  provider: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user: User;
};

export default Token;
