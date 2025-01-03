import mongoose from "mongoose";

const connectMongoDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL)
        console.log(`mongodb connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to mongodb: ${error.message}`);
        process.exit(1)
    }
}

export default connectMongoDB;
