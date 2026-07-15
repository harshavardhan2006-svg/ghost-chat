async function testAuth() {
  const email = `tester-${Date.now()}@ghost.app`;
  const password = "Password123";

  console.log(`Starting live API Auth test...`);
  console.log(`Target Email: ${email}`);

  // Test Registration
  try {
    const registerResponse = await fetch("https://ghost-chat-backend-hq1v.onrender.com/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const registerData = await registerResponse.json();
    console.log("Register API Response status:", registerResponse.status);
    console.log("Register API Response body:", JSON.stringify(registerData, null, 2));

    if (registerResponse.status === 201 || registerResponse.status === 200) {
      console.log("✅ Registration API: WORKING PERFECTLY!");
    } else {
      console.log("❌ Registration API: FAILED");
      return;
    }

    // Test Login
    const loginResponse = await fetch("https://ghost-chat-backend-hq1v.onrender.com/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const loginData = await loginResponse.json();
    console.log("Login API Response status:", loginResponse.status);
    console.log("Login API Response body:", JSON.stringify(loginData, null, 2));

    if (loginResponse.status === 200) {
      console.log("✅ Login API: WORKING PERFECTLY!");
    } else {
      console.log("❌ Login API: FAILED");
    }
  } catch (error) {
    console.error("Error during API request:", error);
  }
}

testAuth();
