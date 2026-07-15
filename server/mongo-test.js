require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
    try {
        console.log("URI:", process.env.MONGO_URI);

        await mongoose.connect(process.env.MONGO_URI);

        console.log("✅ Connected to MongoDB");
        process.exit(0);
    } catch (err) {
        console.error("❌ Mongo Error:");
        console.error(err);
        process.exit(1);
    }
})();