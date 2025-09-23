import { google } from "googleapis";
import fs from "node:fs";

const key = JSON.parse(fs.readFileSync("./superheroboardv2-22da6951042a.json", "utf8"));

const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.metadata",
  ],
  subject: "bimpe@ecoship.com", // mailbox you want to read
});

const gmail = google.gmail({ version: "v1", auth });

async function run() {
  try {
    // Force token fetch to catch auth errors early
    const token = await auth.authorize();
    console.log("✅ Got access token starting with:", token.access_token?.slice(0, 12));

    // Simple call that proves everything is wired
    const { data } = await gmail.users.getProfile({ userId: "me" });
    console.log("✅ Profile OK:", data);
    
    console.log("🎉 Gmail API is working perfectly!");
    
  } catch (err) {
    // Print the exact Google error payload
    console.error("❌ FAIL:", err.response?.status, err.response?.data || err.message);
    
    if (err.message.includes("invalid_grant")) {
      console.log("💡 This usually means Domain-Wide Delegation isn't configured properly");
      console.log("💡 Check Google Workspace Admin Console > Security > API Controls > Domain-wide delegation");
    }
  }
}

run(); 