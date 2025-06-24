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
# Firebase Configuration (Dashboard)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# ShipHero API Configuration
VITE_SHIPHERO_API_TOKEN=your_shiphero_bearer_token_here
```

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

- **Never commit `.env` files** - These contain sensitive API keys
- **Use environment variables** - All sensitive data should be in environment variables
- **Firebase Functions config** - Use `firebase functions:config:set` for backend secrets
- **Regular token rotation** - Update API tokens regularly for security

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

## 📊 Data Sources

- **Orders Collection**: Real-time order data from ShipHero
- **Not Ready to Ship**: Orders removed from shipping queue
- **Product Sizes**: EFM product configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is private and proprietary.

## 🆘 Support

For support or questions, please contact the development team. 