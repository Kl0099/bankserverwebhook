"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const db = new client_1.PrismaClient();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.get("/hdfcWebhook", (req, res) => {
    res.send("hii");
});
app.post("/hdfcWebhook", async (req, res) => {
    const paymentInformation = {
        token: req.body.token,
        userId: req.body.user_identifier,
        amount: req.body.amount,
        provider: req.body.provider,
        number: req.body.number,
        password: req.body.password,
    };
    if (!paymentInformation.token ||
        !paymentInformation.userId ||
        !paymentInformation.amount ||
        !paymentInformation.provider ||
        !paymentInformation.number ||
        !paymentInformation.password) {
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
        const isValid = bcryptjs_1.default.compare(paymentInformation.password, user?.password || "");
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
    }
    catch (e) {
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
