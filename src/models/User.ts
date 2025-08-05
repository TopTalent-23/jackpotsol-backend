import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  telegramUserId: { type: String, required: true, unique: true },
  username: { type: String },
  evmAddress: { type: String },
  signature: { type: String },
  solanaWallet: { type: String },
  language: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
