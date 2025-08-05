import express from 'express';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { UserModel } from '../models/User';
import { SignJWT } from 'jose';
import cookieParser from 'cookie-parser';

const router = express.Router();
router.use(cookieParser());

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const createToken = async (user: any) => {
  return await new SignJWT({
    telegramUserId: user.telegramUserId,
    username: user.username,
    evmAddress: user.evmAddress,
    userId: user._id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
};

router.get('/login', async (req, res) => {
  const { telegramUserId, username, address, signature, language = 'en', redirectUrl } = req.query;

  if (!telegramUserId || !username || !address || !signature) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    let user = await UserModel.findOne({ telegramUserId });

    if (!user) {
      const wallet = Keypair.generate();
      const solanaWallet = bs58.encode(wallet.secretKey);

      user = await UserModel.create({
        telegramUserId,
        username,
        evmAddress: address,
        signature,
        solanaWallet,
        language,
        createdAt: new Date(),
      });
    }

    const token = await createToken(user);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    if (redirectUrl) {
      const decoded = JSON.parse(Buffer.from(redirectUrl as string, 'base64').toString());
      return res.redirect(decoded.redirectUrl || '/dashboard');
    }

    res.json({ message: 'Authenticated', user });
  } catch (err) {
    console.error('[LOGIN_ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/logout', (_req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out' });
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.auth_token;

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const { payload } = await import('jose').then(({ jwtVerify }) =>
      jwtVerify(token, JWT_SECRET)
    );
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
