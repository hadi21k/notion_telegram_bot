import Token from "./token.types";

type User = {
  id: string;
  email: string;
  name: string;
  chatId: string;
  createdAt: Date;
  updatedAt: Date;
  tokens: Token[];
};

export default User;
