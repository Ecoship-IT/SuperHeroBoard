# ⚡ SuperHero Board ⚡

A real-time order management dashboard for shipping operations.

## 🚀 Features

- **Real-time order tracking** - Live updates from your order management system
- **Shipping analytics** - Hourly shipping volume trends and performance metrics
- **SLA monitoring** - Track on-time shipping performance
- **Multi-client support** - Manage orders across multiple clients
- **Advanced filtering** - Search and filter orders by various criteria
- **Data export** - Export order data to CSV

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+
- Firebase CLI
- ShipHero API access

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/superheroboard.git
cd superheroboard
```

### 2. Environment Configuration

#### Dashboard Environment Variables

Create a `.env` file in the `dashboard/` directory:

```bash
cp env.example dashboard/.env
```

Edit `dashboard/.env` with your Firebase configuration:

```bash
# Authentication - Set these for the dashboard login
# Admin users can access all features including EFM Product Sizes and refresh functionality
VITE_ADMIN_PASSWORD=your_admin_password_here
# Limited users can access the main dashboard and refresh functionality but not other pages
VITE_LIMITED_PASSWORD=your_limited_password_here

# Firebase Configuration (Dashboard)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# ShipHero API Configuration
VITE_SHIPHERO_API_TOKEN=your_shiphero_bearer_token_here

# Client Account Mappings (JSON format)
VITE_CLIENT_MAPPINGS={"account_uuid_1":"Client Name 1","account_uuid_2":"Client Name 2"}
```

#### Role-Based Authentication

SuperHero Board supports three access levels:

1. **Guest Access** - View-only access to the main dashboard (no authentication required)
2. **Limited Access** - Main dashboard access + refresh functionality (requires `VITE_LIMITED_PASSWORD`)
3. **Admin Access** - Full access to all features including EFM Product Sizes (requires `VITE_ADMIN_PASSWORD`)

**Setting Up Passwords:**
- Set strong, unique passwords for both admin and limited access
- Never use default passwords in production
- Store passwords securely and share only with authorized users

**Access Control:**
- **Admin users** can access all dashboard features, including EFM Product Sizes and order refresh
- **Limited users** can view the main dashboard and refresh orders but cannot access additional tools
- **Guest users** can only view the dashboard data without any interactive features

#### Client Account Mapping

The dashboard uses client account UUIDs from ShipHero. To display friendly names instead of UUIDs:

1. **Find your account UUIDs** in your ShipHero data or API responses
2. **Create a JSON mapping** of UUID to display name
3. **Add to your .env file** as a single-line JSON string

**Example:**
```bash
VITE_CLIENT_MAPPINGS={"QWNjb3VudDoxMjM0NTY=":"Acme Corp","QWNjb3VudDo3ODkwMTI=":"Beta LLC"}
```

See `client-mappings.example.json` for a detailed example with instructions.

#### Firebase Functions Configuration

For Firebase Functions, set the ShipHero API token using Firebase CLI:

```bash
firebase functions:config:set shiphero.api_token="your_shiphero_bearer_token_here"
```

### 3. Install Dependencies

#### Dashboard (React App)
```bash
cd dashboard
npm install
```

#### Functions (Backend)
```bash
cd functions
npm install
```

### 4. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore Database
3. Enable Authentication (optional, for password protection)
4. Update `.firebaserc` with your project ID

### 5. Development

#### Start the dashboard locally:
```bash
cd dashboard
npm run dev
```

#### Run functions locally:
```bash
firebase emulators:start --only functions
```

### 6. Deployment

#### Deploy to Firebase Hosting:
```bash
# Build the dashboard
cd dashboard
npm run build

# Deploy everything
firebase deploy
```

## 📁 Project Structure

```
superheroboard/
├── dashboard/              # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main application
│   │   ├── firebase.js    # Firebase configuration
│   │   └── ...
│   └── dist/              # Built files (ignored in git)
├── functions/             # Firebase Cloud Functions
│   ├── index.js           # Main functions
│   └── ...
├── env.example           # Environment template
├── .gitignore
└── README.md
```

## 🔐 Security Notes

### **Environment Variables & Secrets**
- **Never commit `.env` files** - These contain sensitive API keys and passwords
- **Use environment variables** - All sensitive data should be in environment variables
- **Password security** - Use strong, unique passwords for admin and limited access roles
- **Firebase Functions config** - Use `firebase functions:config:set` for backend secrets
- **Regular token rotation** - Update API tokens regularly for security

### **Secured Items**
✅ **ShipHero API Token** - Stored in `VITE_SHIPHERO_API_TOKEN`  
✅ **Authentication Passwords** - Stored in `VITE_ADMIN_PASSWORD` and `VITE_LIMITED_PASSWORD`  
✅ **Client Account Mappings** - Stored in `VITE_CLIENT_MAPPINGS`  
✅ **Build Artifacts** - `/dist` folder excluded from version control  

### **Role-Based Access Control**
- **Admin Role** - Full access to all features and tools
- **Limited Role** - Dashboard view and refresh functionality only  
- **Guest Role** - Read-only dashboard access
- **Route Protection** - Sensitive pages restricted by user role

### **Deployment Security**
- Environment variables are baked into build during `npm run build`
- Sensitive data never exposed in source code or version control
- All client business information properly abstracted from UUIDs

## 🧪 Getting Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon → Project Settings
4. Scroll down to "Your apps" section
5. Click on your web app or create one
6. Copy the config values to your `.env` file

## 🔑 Getting ShipHero API Token

1. Log in to your ShipHero account
2. Go to API settings
3. Generate a new API token
4. Add it to your environment variables

## 🏢 Setting Up Client Mappings

### Finding Account UUIDs

Account UUIDs can be found in several ways:

1. **ShipHero GraphQL API** - Query for orders and examine the `account_uuid` field
2. **Order webhooks** - Check incoming webhook data for `account_uuid`
3. **Firestore data** - Look at existing orders in your database

### Example GraphQL Query to Find Account UUIDs:

```graphql
query {
  orders(first: 10) {
    data {
      edges {
        node {
          order_number
          account {
            id
          }
        }
      }
    }
  }
}
```

### Creating Your Client Mappings:

1. **Identify all unique account UUIDs** from your orders
2. **Map each UUID to a friendly name** (your clients' business names)
3. **Format as JSON** and add to your `.env` file

### Client Mapping Tips:

- Use descriptive names that help identify clients quickly
- Keep names consistent with your business records
- Update mappings when you add new clients
- Use quotes around names with special characters or spaces

### Example Mapping Process:

```bash
# Step 1: Found these UUIDs in your data
QWNjb3VudDoxMjM0NTY= → Your biggest client
QWNjb3VudDo3ODkwMTI= → Small local business
QWNjb3VudDo0NTY3ODk= → Online marketplace

# Step 2: Create descriptive names
QWNjb3VudDoxMjM0NTY= → "Mega Corp Industries" 
QWNjb3VudDo3ODkwMTI= → "Local Craft Store"
QWNjb3VudDo0NTY3ODk= → "Amazon Marketplace"

# Step 3: Format as JSON for .env file
VITE_CLIENT_MAPPINGS={"QWNjb3VudDoxMjM0NTY=":"Mega Corp Industries","QWNjb3VudDo3ODkwMTI=":"Local Craft Store","QWNjb3VudDo0NTY3ODk=":"Amazon Marketplace"}
```

## 📊 Data Sources

- **Orders Collection**: Real-time order data from ShipHero
- **Not Ready to Ship**: Orders removed from shipping queue
- **Product Sizes**: EFM product configuration

## 🆘 Support

For support or questions, please contact the development team. 