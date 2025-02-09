import bcrypt from "bcryptjs";
import express from "express";
import { PrismaClient } from "@prisma/client";
const app = express();
import cors from "cors";
const db = new PrismaClient();
//productiourl : https://bankserverwebhook.onrender.com

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    credentials: true,
    origin: "https://paytmwallate-user-app.vercel.app/",
  })
);
app.get("/", (req, res) => {
  res.send("hellow my freind");
});
app.get("/hdfcWebhook", (req, res) => {
  res.send("hii");
});
app.post("/hdfcWebhook", async (req, res) => {
  const paymentInformation: {
    token: string;
    userId: string;
    amount: string;
    provider?: string;
    number?: string;
    password?: string;
  } = {
    token: req.body.token,
    userId: req.body.user_identifier,
    amount: req.body.amount,
    provider: req.body.provider,
    number: req.body.number,
    password: req.body.password,
  };

  if (
    !paymentInformation.token ||
    !paymentInformation.userId ||
    !paymentInformation.amount ||
    !paymentInformation.provider ||
    !paymentInformation.number ||
    !paymentInformation.password
  ) {
    return res.status(401).json({
      success: false,
      message: "invalid credentials",
    });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: Number(paymentInformation.userId) },
    });
    if (!user) {
      return res.status(403).json({
        success: false,
        message: "User not found",
      });
    }
    const isValid = bcrypt.compare(
      paymentInformation.password,
      user?.password || ""
    );
    if (!isValid || user?.number !== paymentInformation.number) {
      return res.status(403).json({
        success: false,
        message: "Password or phone Number invalid",
      });
    }

    await db.$transaction([
      db.balance.updateMany({
        where: {
          userId: Number(paymentInformation.userId),
        },
        data: {
          amount: {
            // You can also get this from your DB
            increment: Number(paymentInformation.amount),
          },
        },
      }),
      db.onRampTransaction.updateMany({
        where: {
          token: paymentInformation.token,
        },
        data: {
          status: "Success",
        },
      }),

      db.recentTransaction.create({
        data: {
          timestamp: new Date(Date.now()),
          amount: Number(paymentInformation.amount),
          status: "Received",
          userId: Number(paymentInformation.userId),
          provider: paymentInformation.provider,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Captured",
    });
  } catch (e) {
    console.error(e);
    res.status(411).json({
      success: false,
      message: "Error while processing webhook",
    });
  }
});

app.listen(3003, () => {
  console.log("listening on http://localhost:3003");
});
