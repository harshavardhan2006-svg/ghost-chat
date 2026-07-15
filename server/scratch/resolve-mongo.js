const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log("Resolving MongoDB SRV records via Google DNS (8.8.8.8)...");
    
    // Create a resolver configured to use Google DNS
    const resolver = new dns.Resolver();
    resolver.setServers(['8.8.8.8', '8.8.4.4']);
    
    const hostname = 'cluster0.0po7wup.mongodb.net';
    const srvName = `_mongodb._tcp.${hostname}`;
    
    // Resolve SRV records
    const srvRecords = await resolver.resolveSrv(srvName);
    console.log("Resolved SRV Records:", srvRecords);
    
    // Resolve TXT records (which contain options like authSource, replicaSet)
    let txtOptions = "";
    try {
      const txtRecords = await resolver.resolveTxt(hostname);
      console.log("Resolved TXT Records:", txtRecords);
      if (txtRecords && txtRecords.length > 0) {
        txtOptions = txtRecords[0].join('');
      }
    } catch (e) {
      console.log("No TXT records found or failed resolving:", e.message);
    }
    
    // Build direct mongodb:// connection string
    // Format: mongodb://username:password@host1:port,host2:port/db?ssl=true&replicaSet=...
    const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',');
    
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
      console.error("No .env file found in server directory!");
      process.exit(1);
    }
    
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract credentials from existing MONGO_URI
    const uriMatch = envContent.match(/MONGO_URI="?mongodb\+srv:\/\/([^:]+):([^@]+)@/);
    if (!uriMatch) {
      console.error("Could not parse credentials from existing MONGO_URI in .env");
      process.exit(1);
    }
    
    const username = uriMatch[1];
    const password = uriMatch[2];
    
    // Parse options from TXT record
    // e.g. "authSource=admin&replicaSet=atlas-xxxxx-shard-0"
    let options = "ssl=true&authSource=admin&retryWrites=true&w=majority";
    if (txtOptions) {
      // Clean up options or append them
      options = `ssl=true&${txtOptions}`;
    }
    
    const newMongoUri = `mongodb://${username}:${password}@${hosts}/ghost?${options}`;
    console.log("Generated Standard MONGO_URI:", newMongoUri);
    
    // Update .env content
    const updatedEnv = envContent.replace(/MONGO_URI=.*(\r?\n)/, `MONGO_URI=${newMongoUri}$1`);
    fs.writeFileSync(envPath, updatedEnv, 'utf8');
    
    console.log("✅ Successfully updated server/.env with standard connection string!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to resolve MongoDB SRV records:", err);
    process.exit(1);
  }
})();
