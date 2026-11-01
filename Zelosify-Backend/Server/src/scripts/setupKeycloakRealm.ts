import axios from "axios";
import fs from "fs";
import path from "path";

async function setupKeycloak() {
  const baseUrl = "http://localhost:8080/auth";

  console.log("🔐 Authenticating with Keycloak master realm...");
  const tokenRes = await axios.post(
    `${baseUrl}/realms/master/protocol/openid-connect/token`,
    new URLSearchParams({
      username: "admin",
      password: "admin",
      grant_type: "password",
      client_id: "admin-cli",
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const adminToken = tokenRes.data.access_token;
  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };

  // 1. Create or verify realm Zelosify
  console.log("🌐 Creating / verifying realm 'Zelosify'...");
  try {
    await axios.post(
      `${baseUrl}/admin/realms`,
      {
        realm: "Zelosify",
        enabled: true,
        accessTokenLifespan: 21600, // 6 hours
      },
      { headers: authHeaders }
    );
    console.log("✅ Realm 'Zelosify' created.");
  } catch (err: any) {
    if (err.response?.status === 409) {
      console.log("ℹ️ Realm 'Zelosify' already exists.");
    } else {
      console.error("Error creating realm:", err.response?.data || err.message);
    }
  }

  // 2. Create client dynamic-client
  console.log("⚙️ Creating / configuring client 'dynamic-client'...");
  let clientIdUuid = "";
  try {
    await axios.post(
      `${baseUrl}/admin/realms/Zelosify/clients`,
      {
        clientId: "dynamic-client",
        enabled: true,
        clientAuthenticatorType: "client-secret",
        serviceAccountsEnabled: true,
        directAccessGrantsEnabled: true,
        publicClient: false,
        redirectUris: ["http://localhost", "http://localhost:5173/*"],
      },
      { headers: authHeaders }
    );
    console.log("✅ Client 'dynamic-client' created.");
  } catch (err: any) {
    if (err.response?.status === 409) {
      console.log("ℹ️ Client 'dynamic-client' already exists.");
    } else {
      console.error("Error creating client:", err.response?.data || err.message);
    }
  }

  // Fetch client UUID
  const clientsRes = await axios.get(`${baseUrl}/admin/realms/Zelosify/clients?clientId=dynamic-client`, {
    headers: authHeaders,
  });
  clientIdUuid = clientsRes.data[0]?.id;

  // 3. Get Client Secret
  const secretRes = await axios.get(
    `${baseUrl}/admin/realms/Zelosify/clients/${clientIdUuid}/client-secret`,
    { headers: authHeaders }
  );
  const clientSecret = secretRes.data.value;
  console.log(`🔑 Client Secret retrieved: ${clientSecret}`);

  // 4. Get Realm RS256 Public Key
  const keysRes = await axios.get(`${baseUrl}/admin/realms/Zelosify/keys`, {
    headers: authHeaders,
  });
  const rs256Key = keysRes.data.keys.find((k: any) => k.type === "RSA" && k.algorithm === "RS256");
  const publicKey = rs256Key?.publicKey || "";
  console.log(`🔑 RS256 Signature retrieved: ${publicKey.substring(0, 30)}...`);

  // 5. Create Realm Roles
  const roles = ["IT_VENDOR", "HIRING_MANAGER", "BUSINESS_USER", "VENDOR_MANAGER"];
  for (const roleName of roles) {
    try {
      await axios.post(
        `${baseUrl}/admin/realms/Zelosify/roles`,
        { name: roleName },
        { headers: authHeaders }
      );
      console.log(`✅ Role created: ${roleName}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        console.log(`ℹ️ Role ${roleName} already exists.`);
      }
    }
  }

  // 6. Update .env file
  const envPath = path.resolve(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(/KEYCLOAK_CLIENT_SECRET=.*$/m, `KEYCLOAK_CLIENT_SECRET=${clientSecret}`);
  envContent = envContent.replace(/KEYCLOAK_RS256_SIG=.*$/m, `KEYCLOAK_RS256_SIG=${publicKey}`);
  fs.writeFileSync(envPath, envContent, "utf-8");
  console.log("✅ Updated .env with actual KEYCLOAK_CLIENT_SECRET and KEYCLOAK_RS256_SIG!");
}

setupKeycloak()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Setup failed:", e);
    process.exit(1);
  });
