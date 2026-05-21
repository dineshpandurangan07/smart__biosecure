import mongoose from 'mongoose';

let cachedConnection = null;

const connectDB = async () => {
  // If we already have a connected instance, return it immediately
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // Disable Mongoose command buffering in serverless to prevent functions from hanging on disconnect
  mongoose.set('bufferCommands', false);
  
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn('WARNING: MONGO_URI environment variable is not defined!');
    if (process.env.VERCEL || process.env.NETLIFY) {
      throw new Error('Database is not configured. Please add the MONGO_URI environment variable in your Netlify site settings (under Site configuration -> Environment variables) to connect to your live MongoDB database.');
    }
  }

  const connectionUri = uri || 'mongodb://localhost:27017/biosecure_farm';

  try {
    const isLocalhost = connectionUri.includes('localhost') || connectionUri.includes('127.0.0.1');
    const options = {
      serverSelectionTimeoutMS: 5000,
    };
    
    console.log('Connecting to database...');
    const conn = await mongoose.connect(connectionUri, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    cachedConnection = conn;
    return cachedConnection;
  } catch (error) {
    console.error(`Could not connect to standard database: ${error.message}`);
    
    if (process.env.VERCEL || process.env.NETLIFY) {
      throw new Error(`Database connection failed: ${error.message}. Please verify your MONGO_URI environment variable and database IP whitelist/firewall settings.`);
    }

    console.log('Attempting to launch an In-Memory MongoDB Server for presentation/demo mode...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      
      const conn = await mongoose.connect(mongoUri);
      console.log(`In-Memory MongoDB Server Started and Connected: ${mongoUri}`);
      
      console.log('Seeding in-memory database...');
      const { seedInMemory } = await import('../seedInMemory.js');
      await seedInMemory();
      console.log('In-Memory Database Seeded successfully!');
      cachedConnection = conn;
      return cachedConnection;
    } catch (innerError) {
      console.error(`Failed to launch In-Memory MongoDB Server: ${innerError.message}`);
      process.exit(1);
    }
  }
};

export default connectDB;
