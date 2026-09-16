import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const LanguageContext = createContext();

export const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English', region: 'All India', flag: '🇬🇧' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', region: 'North & Central India', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు', region: 'Telangana & Andhra Pradesh', flag: '🌾' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்', region: 'Tamil Nadu & Puducherry', flag: '🌴' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', region: 'Karnataka', flag: '🌱' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം', region: 'Kerala', flag: '🥥' },
    { code: 'mr', name: 'Marathi', native: 'मराठी', region: 'Maharashtra', flag: '🚩' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', region: 'Gujarat', flag: '🌻' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা', region: 'West Bengal & Tripura', flag: '🐟' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', region: 'Punjab & Haryana', flag: '🚜' },
    { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', region: 'Odisha', flag: '🌊' },
    { code: 'as', name: 'Assamese', native: 'অসমীয়া', region: 'Assam & Northeast', flag: '🌿' },
    { code: 'ur', name: 'Urdu', native: 'اردو', region: 'National', flag: '📜' },
    { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', region: 'Classical', flag: '🕉️' },
    { code: 'mai', name: 'Maithili', native: 'मैथिली', region: 'Bihar & Jharkhand', flag: '🌾' },
    { code: 'bho', name: 'Bhojpuri', native: 'भोजपुरी', region: 'UP & Bihar', flag: '🌽' },
    { code: 'ne', name: 'Nepali', native: 'नेपाली', region: 'Sikkim & West Bengal', flag: '🏔️' },
    { code: 'gom', name: 'Konkani', native: 'कोंकणी', region: 'Goa & Coastal Karnataka', flag: '🏖️' },
    { code: 'sd', name: 'Sindhi', native: 'سنڌي', region: 'National', flag: '🏺' },
    { code: 'doi', name: 'Dogri', native: 'डोगरी', region: 'Jammu & Kashmir', flag: '🍎' }
];

export const TRANSLATIONS = {
    en: {
        // App Core
        appName: 'KisanConnect',
        tagline: 'Unified Agricultural Ecosystem',
        taglineDesc: 'Empowering Indian farmers, mill operators, and transport fleets with QR-verified intake, live pricing, and transparent digital logistics.',
        
        // Roles & Portals
        farmerPortal: 'Farmer Portal',
        farmerPortalSubtitle: 'Empower Your Yield',
        farmerPortalDesc: 'Real-time weather, market rates, direct mill enquiries, QR gate pass, and instant direct bank payments.',
        millPortal: 'Mills',
        millPortalSubtitle: 'Grain Procurement',
        millPortalDesc: 'Weighbridge intake, automated quintal conversions, direct farmer bank payouts, and gate QR scans.',
        transportPortal: 'Transport Provider',
        transportPortalSubtitle: 'Smart Agro-Logistics',
        transportPortalDesc: 'Smart truck capacity matching, haulage bids, trip progress, and freight payouts.',
        enterPortal: 'Enter Portal',
        
        // Navigation
        dashboard: 'Dashboard',
        crops: 'My Crops',
        myCrops: 'My Crops',
        mills: 'Nearby Mills',
        nearbyMills: 'Nearby Mills',
        cropsAndMills: 'My Crops & Mills',
        enquiries: 'My Enquiries',
        myEnquiries: 'My Enquiries',
        qrcodes: 'My QR Codes',
        myQrCodes: 'My QR Codes',
        payments: 'Payments',
        loadstatus: 'Load Status',
        transport: 'Transport',
        history: 'History & Ledger',
        market: 'Market Prices',
        profile: 'Profile',
        profileSettings: 'Profile & Settings',
        logout: 'Logout',
        
        // Farmer Dashboard
        goodDay: 'Good Day',
        welcomeSub: 'Connected directly to mills, transparent grain discovery, and instant QR verification.',
        addNewCrop: 'Add New Crop',
        activeCrops: 'Active Crops',
        sentEnquiries: 'Sent Enquiries',
        verificationQrs: 'Verification QRs',
        directPayments: 'Direct Payments',
        settlementsReceived: 'Settlements Received',
        readyForDelivery: 'Scan-ready for delivery',
        viewQr: 'View QR',
        viewVerificationQr: 'View Verification QR',
        searchPlaceholder: 'Search crops, prices, enquiries...',
        
        // Crops Tab
        registeredHarvest: 'Registered Harvest & Crop Lots',
        cropVariety: 'Crop Variety',
        acres: 'Acres',
        estimatedYield: 'Estimated Yield',
        harvestDate: 'Harvest Date',
        farmLocation: 'Farm Location',
        actions: 'Actions',
        deleteCrop: 'Delete Crop',
        findNearbyMills: 'Find Mills',
        noCropsFound: 'No crops added yet. Add your first crop above!',
        
        // Mills Tab
        verifiedMillsTitle: 'Verified Processing Mills & Live Rates',
        comparePrices: 'Compare APMC mandi rates with verified mill direct purchasing prices',
        highestOffer: 'Highest Offer',
        perQuintal: 'per Quintal',
        sendEnquiry: 'Send Enquiry',
        capacity: 'Daily Capacity',
        distance: 'Distance',
        contactMill: 'Contact Mill',
        noMillsFound: 'No mills currently found in your radius.',
        
        // Enquiries Tab
        produceEnquiriesTitle: 'My Produce Enquiries & Price Negotiation',
        filterAll: 'All',
        filterPending: 'Pending',
        filterAccepted: 'Accepted',
        filterRejected: 'Rejected',
        offeredRate: 'Offered Rate',
        agreedPrice: 'Agreed Price',
        transportRequired: 'Transport Required',
        pickupDate: 'Pickup Date',
        weighedQuantity: 'Weighed Quantity',
        paymentStatus: 'Payment Status',
        
        // Payments & Settlements
        paymentsTitle: 'Direct Mill Payments & Settlements',
        paymentsSubtitle: 'Transparent weighbridge quantities, quintal rate conversions, and direct bank payouts from mills',
        updateBankAccount: 'Update Bank Account',
        totalPaymentsReceived: 'Total Payments Received',
        completedTransfers: 'completed mill transfers',
        pendingSettlements: 'Pending Settlements',
        awaitingMillPayment: 'loads awaiting mill payment',
        totalWeighedProduce: 'Total Weighed Produce',
        deliveredQuintals: 'Quintals delivered',
        registeredBankTitle: 'My Registered Bank Account for Mill Direct Payouts',
        verifiedForTransfer: 'Verified for Direct Transfer',
        accountHolder: 'Account Holder Name',
        bankName: 'Bank Name',
        accountNumber: 'Account Number',
        ifscCode: 'IFSC Code',
        upiId: 'UPI ID',
        allTransactions: 'All Transactions',
        paymentCompleted: 'Payment Completed',
        paymentPending: 'Payment Pending',
        awaitingMill: 'AWAITING MILL',
        enquiryRef: 'Enquiry Ref',
        purchaserMill: 'Purchaser Mill',
        cropAndQuantity: 'Crop & Quantity',
        pricePerQuintal: 'Price / Quintal',
        totalAmount: 'Total Amount',
        status: 'Status',
        paymentDate: 'Payment Date',
        receipt: 'Receipt',
        viewBill: 'View Bill',
        viewSlip: 'View Slip',
        close: 'Close',
        print: 'Print',
        saveBankDetails: 'Save Bank Details',
        tonnes: 'Tonnes',
        quintals: 'Quintals',
        shareWhatsApp: 'Share via WhatsApp',
        
        // Profile & Preferences
        profileTitle: 'Farmer Profile & Settings',
        generalTab: 'General Details',
        farmPersonalTab: 'Farm & Personal Info',
        payoutTab: 'Direct Payout & Bank',
        securityTab: 'Security PIN',
        preferencesTab: 'Preferences & Language',
        preferredLanguage: 'Preferred Language',
        languageSettingDesc: 'Select your regional language for dashboard labels, crop information, and notifications.',
        savePreferences: 'Save Preferences',
        savedSuccess: 'Language preference saved successfully!',
        fullName: 'Full Name',
        primaryPhone: 'Primary Phone (Registered)',
        altPhone: 'WhatsApp / Alternate Phone',
        village: 'Village / Gram Panchayat',
        districtState: 'District & State',
        farmingPractice: 'Primary Farming Practice',
        saveProfileChanges: 'Save Profile Changes',
        totalLandHolding: 'Total Land Holding',
        registeredCrops: 'Registered Crops',
        millEnquiries: 'Mill Enquiries',
        kycStatus: 'KYC Status',
        verifiedFarmer: 'Verified Farmer',
        dailyMandiAlerts: 'Daily Mandi Price Alerts',
        loadDispatchSms: 'Load Dispatch & Arrival SMS',
        extremeWeatherAlerts: 'Extreme Weather Advisories',
        
        // Mill Buyer Portal
        paymentsAndLoads: 'Payments & Loads',
        loadsPendingBadge: 'Pending',
        confirmLoadReceived: 'Confirm Load Received',
        actualTonnesReceived: 'Actual Tonnes Received (Weighbridge)',
        convertedQuintals: 'Converted Quintals (1T = 10 Qtl)',
        automatedCalculation: 'Automated Bill Calculation',
        totalPayableAmount: 'Total Payable Amount',
        makePayment: 'Make Payment',
        farmerBankDetailsTitle: 'Farmer Bank Details (For Transfer)',
        copyAccount: 'Copy Account Number',
        copyIfsc: 'Copy IFSC Code',
        copyUpi: 'Copy UPI',
        paymentMethod: 'Payment Method',
        utrReference: 'Transaction / UTR Reference No.',
        confirmPaymentCompleted: 'Payment Completed',
        produceIntakeReceipt: 'Produce Intake Payment Receipt',
        scanFarmerQr: 'Scan Gate QR',
        
        // Common Buttons & Badges
        save: 'Save',
        cancel: 'Cancel',
        confirm: 'Confirm',
        delete: 'Delete',
        edit: 'Edit',
        active: 'Active',
        pending: 'Pending',
        completed: 'Completed',
        paid: 'Paid',
        yes: 'Yes',
        no: 'No',
        back: 'Back',
        footerCopyright: '© 2026 KisanConnect Ecosystem'
    },

    te: {
        // App Core (తెలుగు)
        appName: 'కిసాన్ కనెక్ట్',
        tagline: 'సమగ్ర వ్యవసాయ డిజిటల్ వ్యవస్థ',
        taglineDesc: 'రైతులు, మిల్లు యజమానులు మరియు రవాణాదారులను క్యూఆర్ తూకం, ప్రత్యక్ష ధరలు మరియు డిజిటల్ చెల్లింపులతో అనుసంధానించడం.',
        
        // Roles & Portals
        farmerPortal: 'రైతు పోర్టల్',
        farmerPortalSubtitle: 'మీ దిగుబడికి నిజమైన విలువ',
        farmerPortalDesc: 'వాతావరణ వివరాలు, మార్కెట్ ధరలు, మిల్లు విచారణలు, క్యూఆర్ గేట్ పాస్ మరియు బ్యాంక్ ఖాతాకు నేరుగా చెల్లింపులు.',
        millPortal: 'రైస్ & దాల్ మిల్లులు',
        millPortalSubtitle: 'ధాన్య సేకరణ & ప్రాసెసింగ్',
        millPortalDesc: 'వేబ్రిడ్జి తూకం, ఆటోమేటిక్ క్వింటాళ్ల బిల్లు, రైతులకు నేరుగా బ్యాంక్ చెల్లింపులు మరియు క్యూఆర్ స్కానింగ్.',
        transportPortal: 'రవాణా సేవలు',
        transportPortalSubtitle: 'స్మార్ట్ వ్యవసాయ రవాణా',
        transportPortalDesc: 'ట్రక్ కెపాసిటీ మ్యాచింగ్, రవాణా ధరలు, ట్రిప్ ట్రాకింగ్ మరియు తక్షణ కిరాయి చెల్లింపులు.',
        enterPortal: 'పోర్టల్‌లోకి ప్రవేశించండి',
        
        // Navigation
        dashboard: 'డ్యాష్‌బోర్డ్',
        crops: 'నా పంటలు',
        myCrops: 'నా పంటలు',
        mills: 'సమీప మిల్లులు',
        nearbyMills: 'సమీప మిల్లులు',
        cropsAndMills: 'పంటలు & సమీప మిల్లులు',
        enquiries: 'నా విచారణలు',
        myEnquiries: 'నా విచారణలు',
        qrcodes: 'నా క్యూఆర్ కోడ్‌లు',
        myQrCodes: 'నా క్యూఆర్ కోడ్‌లు',
        payments: 'చెల్లింపులు',
        loadstatus: 'లోడ్ స్థితి',
        transport: 'రవాణా',
        history: 'చరిత్ర & లెడ్జర్',
        market: 'మార్కెట్ ధరలు',
        profile: 'ప్రొఫైల్',
        profileSettings: 'ప్రొఫైల్ & సెట్టింగ్‌లు',
        logout: 'లాగ్ అవుట్',
        
        // Farmer Dashboard
        goodDay: 'నమస్కారం',
        welcomeSub: 'మిల్లులతో నేరుగా అనుసంధానం, పారదర్శక ధరలు మరియు తక్షణ క్యూఆర్ ధృవీకరణ.',
        addNewCrop: 'కొత్త పంట జోడించండి',
        activeCrops: 'క్రియాశీల పంటలు',
        sentEnquiries: 'పంపిన విచారణలు',
        verificationQrs: 'ధృవీకరణ క్యూఆర్',
        directPayments: 'ప్రత్యక్ష చెల్లింపులు',
        settlementsReceived: 'అందిన చెల్లింపులు',
        readyForDelivery: 'రవాణాకు సిద్ధంగా ఉంది',
        viewQr: 'క్యూఆర్ చూడండి',
        viewVerificationQr: 'ధృవీకరణ క్యూఆర్ చూడండి',
        searchPlaceholder: 'పంటలు, ధరలు, విచారణలు వెతకండి...',
        
        // Crops Tab
        registeredHarvest: 'నమోదిత పంటలు & దిగుబడి లాట్లు',
        cropVariety: 'పంట రకం',
        acres: 'ఎకరాలు',
        estimatedYield: 'అంచనా దిగుబడి (టన్నులు)',
        harvestDate: 'కోత తేదీ',
        farmLocation: 'పొలం ఉన్న ప్రాంతం',
        actions: 'చర్యలు',
        deleteCrop: 'పంటను తొలగించు',
        findNearbyMills: 'మిల్లులను కనుగొనండి',
        noCropsFound: 'ఇంకా పంటలు నమోదు చేయలేదు. పైన ఉన్న బటన్ నొక్కి జోడించండి!',
        
        // Mills Tab
        verifiedMillsTitle: 'ధృవీకరించబడిన మిల్లులు & ప్రత్యక్ష ధరలు',
        comparePrices: 'వ్యవసాయ మార్కెట్ (APMC) ధరలతో మిల్లు కొనుగోలు ధరలను సరిపోల్చండి',
        highestOffer: 'గరిష్ట ధర ఆఫర్',
        perQuintal: 'క్వింటాకు',
        sendEnquiry: 'విచారణ పంపండి',
        capacity: 'రోజువారీ సామర్థ్యం',
        distance: 'దూరం',
        contactMill: 'మిల్లును సంప్రదించండి',
        noMillsFound: 'మీ సమీపంలో ప్రస్తుతం మిల్లులు అందుబాటులో లేవు.',
        
        // Enquiries Tab
        produceEnquiriesTitle: 'నా పంట విచారణలు & ధరల సంప్రదింపులు',
        filterAll: 'అన్నీ',
        filterPending: 'పెండింగ్',
        filterAccepted: 'అంగీకరించినవి',
        filterRejected: 'తిరస్కరించినవి',
        offeredRate: 'ఆఫర్ చేసిన ధర',
        agreedPrice: 'ఖరారైన ధర',
        transportRequired: 'రవాణా అవసరమా',
        pickupDate: 'లోడింగ్ తేదీ',
        weighedQuantity: 'తూకం వేసిన పరిమాణం',
        paymentStatus: 'చెల్లింపు స్థితి',
        
        // Payments & Settlements
        paymentsTitle: 'మిల్లు ప్రత్యక్ష చెల్లింపులు & సెటిల్‌మెంట్లు',
        paymentsSubtitle: 'వేబ్రిడ్జి ఖచ్చితమైన తూకం, క్వింటా లెక్కలు మరియు బ్యాంకుకు నేరుగా బదిలీ',
        updateBankAccount: 'బ్యాంక్ ఖాతా నవీకరణ',
        totalPaymentsReceived: 'మొత్తం అందిన చెల్లింపులు',
        completedTransfers: 'పూర్తయిన మిల్లు బదిలీలు',
        pendingSettlements: 'పెండింగ్ చెల్లింపులు',
        awaitingMillPayment: 'చెల్లింపు కోసం వేచి ఉన్న లోడ్లు',
        totalWeighedProduce: 'మొత్తం తూకం వేసిన పంట',
        deliveredQuintals: 'డెలివరీ చేసిన క్వింటాళ్లు',
        registeredBankTitle: 'మిల్లుల నుండి నేరుగా చెల్లింపుల కోసం నమోదిత బ్యాంక్ ఖాతా',
        verifiedForTransfer: 'ప్రత్యక్ష బదిలీకి ధృవీకరించబడింది',
        accountHolder: 'ఖాతాదారుని పేరు',
        bankName: 'బ్యాంక్ పేరు',
        accountNumber: 'ఖాతా సంఖ్య',
        ifscCode: 'ఐఎఫ్‌ఎస్‌సి (IFSC) కోడ్',
        upiId: 'యుపిఐ (UPI) ఐడీ',
        allTransactions: 'అన్ని లావాదేవీలు',
        paymentCompleted: 'చెల్లింపు పూర్తయింది',
        paymentPending: 'చెల్లింపు పెండింగ్',
        awaitingMill: 'మిల్లు చెల్లింపు పెండింగ్',
        enquiryRef: 'విచారణ సంఖ్య',
        purchaserMill: 'కొనుగోలు మిల్లు',
        cropAndQuantity: 'పంట & పరిమాణం',
        pricePerQuintal: 'క్వింటా ధర',
        totalAmount: 'మొత్తం సొమ్ము',
        status: 'స్థితి',
        paymentDate: 'చెల్లింపు తేదీ',
        receipt: 'రసీదు',
        viewBill: 'బిల్లు చూడండి',
        viewSlip: 'స్లిప్ చూడండి',
        close: 'మూసివేయి',
        print: 'ప్రింట్',
        saveBankDetails: 'బ్యాంక్ వివరాలు భద్రపరచండి',
        tonnes: 'టన్నులు',
        quintals: 'క్వింటాళ్లు',
        shareWhatsApp: 'వాట్సాప్‌లో షేర్ చేయండి',
        
        // Profile & Preferences
        profileTitle: 'రైతు ప్రొఫైల్ & సెట్టింగ్‌లు',
        generalTab: 'సాధారణ వివరాలు',
        farmPersonalTab: 'వ్యవసాయ & వ్యక్తిగత సమాచారం',
        payoutTab: 'బ్యాంక్ వివరాలు & చెల్లింపులు',
        securityTab: 'సెక్యూరిటీ పిన్ (PIN)',
        preferencesTab: 'ప్రాధాన్యతలు & భాష',
        preferredLanguage: 'ఇష్టపడే ప్రాంతీయ భాష',
        languageSettingDesc: 'డ్యాష్‌బోర్డ్, పంట వివరాలు మరియు నోటిఫికేషన్‌ల కోసం మీ స్థానిక భాషను ఎంచుకోండి.',
        savePreferences: 'ప్రాధాన్యతలు భద్రపరచండి',
        savedSuccess: 'భాష విజయవంతంగా మార్చబడింది!',
        fullName: 'పూర్తి పేరు',
        primaryPhone: 'నమోదిత ప్రాథమిక ఫోన్',
        altPhone: 'వాట్సాప్ / ప్రత్యామ్నాయ ఫోన్',
        village: 'గ్రామం / గ్రామ పంచాయితీ',
        districtState: 'జిల్లా & రాష్ట్రం',
        farmingPractice: 'ప్రధాన వ్యవసాయ పద్ధతి',
        saveProfileChanges: 'ప్రొఫైల్ మార్పులు భద్రపరచండి',
        totalLandHolding: 'మొత్తం సాగు భూమి',
        registeredCrops: 'నమోదిత పంటలు',
        millEnquiries: 'మిల్లు విచారణలు',
        kycStatus: 'కేవైసీ (KYC) స్థితి',
        verifiedFarmer: 'ధృవీకరించబడిన రైతు',
        dailyMandiAlerts: 'రోజువారీ మార్కెట్ ధరల హెచ్చరికలు',
        loadDispatchSms: 'రవాణా బయలుదేరడం & చేరడంపై SMS',
        extremeWeatherAlerts: 'వాతావరణ మార్పుల ముందస్తు హెచ్చరికలు',
        
        // Mill Buyer Portal
        paymentsAndLoads: 'చెల్లింపులు & లోడ్లు',
        loadsPendingBadge: 'పెండింగ్',
        confirmLoadReceived: 'లోడ్ రసీదును నిర్ధారించండి',
        actualTonnesReceived: 'వేబ్రిడ్జి వాస్తవ టన్నుల తూకం',
        convertedQuintals: 'మార్చిన క్వింటాళ్లు (1 టన్ను = 10 క్వింటాళ్లు)',
        automatedCalculation: 'ఆటోమేటిక్ బిల్లు లెక్కింపు',
        totalPayableAmount: 'చెల్లించవలసిన మొత్తం',
        makePayment: 'చెల్లింపు చేయండి',
        farmerBankDetailsTitle: 'రైతు బ్యాంక్ వివరాలు (బదిలీ కోసం)',
        copyAccount: 'ఖాతా సంఖ్య కాపీ',
        copyIfsc: 'IFSC కోడ్ కాపీ',
        copyUpi: 'UPI కాపీ',
        paymentMethod: 'చెల్లింపు విధానం',
        utrReference: 'లావాదేవీ / UTR రిఫరెన్స్ సంఖ్య',
        confirmPaymentCompleted: 'చెల్లింపు పూర్తయింది',
        produceIntakeReceipt: 'పంట కొనుగోలు చెల్లింపు రసీదు',
        scanFarmerQr: 'గేట్ క్యూఆర్ స్కాన్ చేయండి',
        
        // Common
        save: 'భద్రపరచు',
        cancel: 'రద్దు చేయి',
        confirm: 'నిర్ధారించు',
        delete: 'తొలగించు',
        edit: 'సవరించు',
        active: 'క్రియాశీలం',
        pending: 'పెండింగ్',
        completed: 'పూర్తయింది',
        paid: 'చెల్లించబడింది',
        yes: 'అవును',
        no: 'కాదు',
        back: 'వెనుకకు',
        footerCopyright: '© 2026 కిసాన్ కనెక్ట్ ఎకోసిస్టమ్'
    },

    hi: {
        // App Core (हिन्दी)
        appName: 'किसान कनेक्ट',
        tagline: 'एकीकृत कृषि डिजिटल मंच',
        taglineDesc: 'किसानों, मिल मालिकों और ट्रांसपोर्टरों को डिजिटल तौल, पारदर्शी भाव और त्वरित बैंक भुगतान से जोड़ना।',
        
        // Roles & Portals
        farmerPortal: 'किसान पोर्टल',
        farmerPortalSubtitle: 'अपनी उपज का सही मूल्य पाएं',
        farmerPortalDesc: 'मौसम, मंडी भाव, सीधे मिल सौदे, क्यूआर गेट पास और बैंक खाते में त्वरित प्रत्यक्ष भुगतान।',
        millPortal: 'मिल एवं खरीददार',
        millPortalSubtitle: 'अनाज खरीद एवं प्रसंस्करण',
        millPortalDesc: 'वेब्रिज तौल, स्वचालित क्विंटल बिल, सीधे बैंक ट्रांसफर और क्यूआर स्कैन।',
        transportPortal: 'परिवहन सेवा',
        transportPortalSubtitle: 'स्मार्ट कृषि लॉजिस्टिक्स',
        transportPortalDesc: 'स्मार्ट ट्रक क्षमता मिलान, भाड़ा बोली, लाइव ट्रैकिंग और त्वरित मालभाड़ा भुगतान।',
        enterPortal: 'पोर्टल में प्रवेश करें',
        
        // Navigation
        dashboard: 'डैशबोर्ड',
        crops: 'मेरी फसलें',
        myCrops: 'मेरी फसलें',
        mills: 'नजदीकी मिलें',
        nearbyMills: 'नजदीकी मिलें',
        cropsAndMills: 'मेरी फसलें और मिलें',
        enquiries: 'मेरी पूछताछ',
        myEnquiries: 'मेरी पूछताछ',
        qrcodes: 'मेरे क्यूआर कोड',
        myQrCodes: 'मेरे क्यूआर कोड',
        payments: 'भुगतान',
        loadstatus: 'लोड स्थिति',
        transport: 'परिवहन',
        history: 'इतिहास और लेज़र',
        market: 'मंडी भाव',
        profile: 'प्रोफ़ाइल',
        profileSettings: 'प्रोफ़ाइल और सेटिंग्स',
        logout: 'लॉग आउट',
        
        // Farmer Dashboard
        goodDay: 'नमस्ते',
        welcomeSub: 'मिलों से सीधा संपर्क, पारदर्शी अनाज भाव और त्वरित डिजिटल सत्यापन।',
        addNewCrop: 'नई फसल जोड़ें',
        activeCrops: 'सक्रिय फसलें',
        sentEnquiries: 'भेजी गई पूछताछ',
        verificationQrs: 'सत्यापन क्यूआर',
        directPayments: 'सीधा भुगतान',
        settlementsReceived: 'प्राप्त भुगतान',
        readyForDelivery: 'डिलीवरी के लिए तैयार',
        viewQr: 'क्यूआर देखें',
        viewVerificationQr: 'सत्यापन क्यूआर देखें',
        searchPlaceholder: 'फसलें, भाव, पूछताछ खोजें...',
        
        // Crops Tab
        registeredHarvest: 'पंजीकृत फसलें और लॉट',
        cropVariety: 'फसल की किस्म',
        acres: 'एकड़',
        estimatedYield: 'अनुमानित उपज (टन)',
        harvestDate: 'कटाई तिथि'
    },
    // Tamil (தமிழ்)
    ta: {
        appName: 'கிசான் கனெக்ட்',
        tagline: 'ஒருங்கிணைந்த விவசாய டிஜிட்டல் தளம்',
        taglineDesc: 'விவசாயிகள், ஆலை உரிமையாளர்கள் மற்றும் லாரி ஓட்டுநர்களை டிஜிட்டல் எடை மற்றும் உடனடி வங்கி கொடுப்பனவுகளுடன் இணைக்கிறது.',
        farmerPortal: 'விவசாயி போர்ட்டல்',
        farmerPortalSubtitle: 'உங்கள் விளைச்சலுக்கு நியாயமான விலை',
        farmerPortalDesc: 'வானிலை, சந்தை விலை, நேரடி ஆலை விசாரணைகள், QR கேட் பாஸ் மற்றும் நேரடி வங்கி பரிவர்த்தனை.',
        millPortal: 'ஆலைகள் & வாங்குவோர்',
        millPortalSubtitle: 'தானிய கொள்முதல் & செயலாக்கம்',
        millPortalDesc: 'எடைபாலம் எடை, தானியங்கி குவிண்டால் கணக்கீடு, நேரடி வங்கி கொடுப்பனவு மற்றும் QR ஸ்கேன்.',
        transportPortal: 'போக்குவரத்து சேவை',
        transportPortalSubtitle: 'ஸ்மார்ட் விவசாய சரக்கு',
        transportPortalDesc: 'டிரக் கொள்ளளவு பொருத்தம், கட்டண ஏலம், நேரடி கண்காணிப்பு மற்றும் உடனடி வாடகை கொடுப்பனவு.',
        enterPortal: 'நுழையவும்',
        dashboard: 'டாஷ்போர்டு',
        crops: 'எனது பயிர்கள்',
        myCrops: 'எனது பயிர்கள்',
        mills: 'அருகிலுள்ள ஆலைகள்',
        nearbyMills: 'அருகிலுள்ள ஆலைகள்',
        cropsAndMills: 'எனது பயிர்கள் & ஆலைகள்',
        enquiries: 'எனது விசாரணைகள்',
        myEnquiries: 'எனது விசாரணைகள்',
        qrcodes: 'எனது QR குறியீடுகள்',
        myQrCodes: 'எனது QR குறியீடுகள்',
        payments: 'கொடுப்பனவுகள்',
        loadstatus: 'சுமை நிலை',
        transport: 'போக்குவரத்து',
        history: 'வரலாறு & பேரேடு',
        market: 'சந்தை விலைகள்',
        profile: 'சுயவிவரம்',
        profileSettings: 'சுயவிவரம் & அமைப்புகள்',
        logout: 'வெளியேறு',
        goodDay: 'வணக்கம்',
        welcomeSub: 'ஆலைகளுடன் நேரடி தொடர்பு, வெளிப்படையான விலை மற்றும் உடனடி QR சரிபார்ப்பு.',
        addNewCrop: 'புதிய பயிர் சேர்க்க',
        activeCrops: 'செயலில் உள்ள பயிர்கள்',
        sentEnquiries: 'அனுப்பிய விசாரணைகள்',
        verificationQrs: 'சரிபார்ப்பு QR',
        directPayments: 'நேரடி கொடுப்பனவு',
        settlementsReceived: 'பெறப்பட்ட பணம்',
        readyForDelivery: 'டெலிவரிக்கு தயார்',
        viewQr: 'QR பார்க்க',
        paymentsTitle: 'நேரடி ஆலை கொடுப்பனவு & தீர்வு',
        paymentsSubtitle: 'எடைபாலம் துல்லிய எடை, குவிண்டால் கணக்கீடு மற்றும் நேரடி வங்கி வரவு',
        updateBankAccount: 'வங்கி கணக்கை புதுப்பிக்க',
        totalPaymentsReceived: 'மொத்தம் பெறப்பட்ட தொகை',
        completedTransfers: 'வெற்றிகரமான வங்கி பரிமாற்றங்கள்',
        pendingSettlements: 'நிலுவையில் உள்ள கொடுப்பனவு',
        totalWeighedProduce: 'மொத்த எடையுள்ள விளைச்சல்',
        registeredBankTitle: 'நேரடி கொடுப்பனவுக்கான பதிவு செய்யப்பட்ட வங்கி கணக்கு',
        verifiedForTransfer: 'நேரடி பரிமாற்றத்திற்கு சரிபார்க்கப்பட்டது',
        accountHolder: 'கணக்கு வைத்திருப்பவர் பெயர்',
        bankName: 'வங்கி பெயர்',
        accountNumber: 'கணக்கு எண்',
        ifscCode: 'IFSC குறியீடு',
        upiId: 'UPI ஐடி',
        allTransactions: 'அனைத்து பரிவர்த்தனைகள்',
        paymentCompleted: 'பணம் செலுத்தப்பட்டது',
        paymentPending: 'பணம் நிலுவையில் உள்ளது',
        preferredLanguage: 'விருப்பமான மொழி',
        save: 'சேமி',
        cancel: 'ரத்து செய்',
        footerCopyright: '© 2026 கிசான் கனெக்ட்'
    },

    // Marathi (मराठी)
    mr: {
        appName: 'किसान कनेक्ट',
        tagline: 'एकीकृत कृषी डिजिटल प्लॅटफॉर्म',
        taglineDesc: 'शेतकरी, मिल मालक आणि वाहतूकदारांना डिजिटल वजन आणि थेट बँक पेमेंटसह जोडणे.',
        farmerPortal: 'शेतकरी पोर्टल',
        farmerPortalSubtitle: 'तुमच्या पिकाला योग्य भाव',
        farmerPortalDesc: 'हवामान, बाजार भाव, थेट मिल सौदे, QR गेट पास आणि बँक खात्यात थेट पेमेंट.',
        millPortal: 'मिल आणि खरेदीदार',
        millPortalSubtitle: 'धान्य खरेदी व प्रक्रिया',
        millPortalDesc: 'वेब्रिज वजन, स्वयंचलित क्विंटल बिल, थेट बँक ट्रान्सफर आणि QR स्कॅन.',
        transportPortal: 'वाहतूक सेवा',
        transportPortalSubtitle: 'स्मार्ट कृषी लॉजिस्टिक्स',
        transportPortalDesc: 'ट्रक क्षमता जुळणी, भाडे बोली, थेट ट्रॅकिंग आणि त्वरित भाडे पेमेंट.',
        enterPortal: 'प्रवेश करा',
        dashboard: 'डॅशबोर्ड',
        crops: 'माझी पिके',
        myCrops: 'माझी पिके',
        mills: 'जवळपासच्या मिल्स',
        nearbyMills: 'जवळपासच्या मिल्स',
        cropsAndMills: 'माझी पिके आणि मिल्स',
        enquiries: 'माझ्या चौकशी',
        myEnquiries: 'माझ्या चौकशी',
        qrcodes: 'माझे QR कोड',
        myQrCodes: 'माझे QR कोड',
        payments: 'पेमेंट्स',
        loadstatus: 'लोड स्थिती',
        transport: 'वाहतूक',
        history: 'इतिहास आणि लेजर',
        market: 'बाजार भाव',
        profile: 'प्रोफाइल',
        profileSettings: 'प्रोफाइल आणि सेटिंग्ज',
        logout: 'लॉग आउट',
        goodDay: 'नमस्कार',
        welcomeSub: 'मिलशी थेट संपर्क, पारदर्शक दर आणि त्वरित QR पडताळणी.',
        addNewCrop: 'नवीन पीक जोडा',
        activeCrops: 'सक्रिय पिके',
        sentEnquiries: 'पाठवलेली चौकशी',
        verificationQrs: 'सत्यापन QR',
        directPayments: 'थेट पेमेंट्स',
        settlementsReceived: 'प्राप्त पेमेंट्स',
        readyForDelivery: 'वितरणासाठी तयार',
        viewQr: 'QR पहा',
        paymentsTitle: 'थेट मिल पेमेंट्स आणि सेटलमेंट',
        paymentsSubtitle: 'वेब्रिज वजन, क्विंटल गणना आणि बँक खात्यात थेट पेमेंट',
        updateBankAccount: 'बँक खाते बदला',
        totalPaymentsReceived: 'एकूण प्राप्त पेमेंट्स',
        completedTransfers: 'यशस्वी बँक ट्रान्सफर',
        pendingSettlements: 'प्रलंबित पेमेंट्स',
        totalWeighedProduce: 'एकूण वजन केलेले पीक',
        registeredBankTitle: 'थेट पेमेंटसाठी नोंदणीकृत बँक खाते',
        verifiedForTransfer: 'थेट ट्रान्सफरसाठी सत्यापित',
        accountHolder: 'खातेदाराचे नाव',
        bankName: 'बँकेचे नाव',
        accountNumber: 'खाते क्रमांक',
        ifscCode: 'IFSC कोड',
        upiId: 'UPI आयडी',
        allTransactions: 'सर्व व्यवहार',
        paymentCompleted: 'पेमेंट पूर्ण झाले',
        paymentPending: 'पेमेंट प्रलंबित',
        preferredLanguage: 'पसंतीची भाषा',
        save: 'जतन करा',
        cancel: 'रद्द करा',
        footerCopyright: '© 2026 किसान कनेक्ट'
    }
};

// Global direct string reverse map: maps any known English phrase directly to other languages
const STRING_MAP = {};
Object.keys(TRANSLATIONS.en).forEach(k => {
    const enText = TRANSLATIONS.en[k];
    if (typeof enText === 'string' && enText.trim()) {
        STRING_MAP[enText.trim()] = {};
        Object.keys(TRANSLATIONS).forEach(lang => {
            STRING_MAP[enText.trim()][lang] = TRANSLATIONS[lang]?.[k] || enText;
        });
    }
});

// Additional commonly displayed UI sentences & phrases
const EXTRA_PHRASES = {
    "Unified Agricultural Ecosystem": { te: "సమగ్ర వ్యవసాయ డిజిటల్ వ్యవస్థ", hi: "एकीकृत कृषि डिजिटल मंच", kn: "ಸಮಗ್ರ ಕೃಷಿ ಡಿಜಿಟಲ್ ವೇದಿಕೆ", ta: "ஒருங்கிணைந்த விவசாய டிஜிட்டல் தளம்", mr: "एकीकृत कृषी डिजिटल प्लॅटफॉर्म" },
    "Farmer Portal": { te: "రైతు పోర్టల్", hi: "किसान पोर्टल", kn: "ರೈತ ಪೋರ್ಟಲ್", ta: "விவசாயி போர்ட்டல்", mr: "शेतकरी पोर्टल" },
    "Empower Your Yield": { te: "మీ దిగుబడికి నిజమైన విలువ", hi: "अपनी उपज का सही मूल्य पाएं", kn: "ನಿಮ್ಮ ಬೆಳೆಗೆ ಉತ್ತಮ ಮೌಲ್ಯ", ta: "உங்கள் விளைச்சலுக்கு நியாயமான விலை", mr: "तुमच्या पिकाला योग्य भाव" },
    "Grain Procurement": { te: "ధాన్య సేకరణ & ప్రాసెసింగ్", hi: "अनाज खरीद एवं प्रसंस्करण", kn: "ಧಾನ್ಯ ಖರೀದಿ", ta: "தானிய கொள்முதல்", mr: "धान्य खरेदी" },
    "Smart Agro-Logistics": { te: "స్మార్ట్ వ్యవసాయ రవాణా", hi: "स्मार्ट कृषि लॉजिस्टिक्स", kn: "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಾರಿಗೆ", ta: "ஸ்மார்ட் விவசாய சரக்கு", mr: "स्मार्ट कृषी लॉजिस्टिक्स" },
    "Transport Provider": { te: "రవాణా సేవలు", hi: "परिवहन सेवा", kn: "ಸಾರಿಗೆ ಸೇವೆಗಳು", ta: "போக்குவரத்து சேவை", mr: "वाहतूक सेवा" },
    "Enter Portal": { te: "పోర్టల్‌లోకి ప్రవేశించండి", hi: "पोर्टल में प्रवेश करें", kn: "ಪ್ರವೇಶಿಸಿ", ta: "நுழையவும்", mr: "प्रवेश करा" },
    "Dashboard": { te: "డ్యాష్‌బోర్డ్", hi: "डैशबोर्ड", kn: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", ta: "டாஷ்போர்டு", mr: "डॅशबोर्ड" },
    "My Crops": { te: "నా పంటలు", hi: "मेरी फसलें", kn: "ನನ್ನ ಬೆಳೆಗಳು", ta: "எனது பயிர்கள்", mr: "माझी पिके" },
    "Nearby Mills": { te: "సమీప మిల్లులు", hi: "नजदीकी मिलें", kn: "ಹತ್ತಿರದ ಗಿರಣಿಗಳು", ta: "அருகிலுள்ள ஆலைகள்", mr: "जवळपासच्या मिल्स" },
    "My Enquiries": { te: "నా విచారణలు", hi: "मेरी पूछताछ", kn: "ನನ್ನ ವಿಚಾರಣೆಗಳು", ta: "எனது விசாரணைகள்", mr: "माझ्या चौकशी" },
    "My QR Codes": { te: "నా క్యూఆర్ కోడ్‌లు", hi: "मेरे क्यूआर कोड", kn: "ನನ್ನ ಕ್ಯೂಆರ್ ಕೋಡ್‌ಗಳು", ta: "எனது QR குறியீடுகள்", mr: "माझे QR कोड" },
    "Payments": { te: "చెల్లింపులు", hi: "भुगतान", kn: "ಪಾವತಿಗಳು", ta: "கொடுப்பனவுகள்", mr: "पेमेंट्स" },
    "Load Status": { te: "లోడ్ స్థితి", hi: "लोड स्थिति", kn: "ಲೋಡ್ ಸ್ಥಿತಿ", ta: "சுமை நிலை", mr: "लोड स्थिती" },
    "Transport": { te: "రవాణా", hi: "परिवहन", kn: "ಸಾರಿಗೆ", ta: "போக்குவரத்து", mr: "वाहतूक" },
    "History & Ledger": { te: "చరిత్ర & లెడ్జర్", hi: "इतिहास और लेज़र", kn: "ಇತಿಹಾಸ & ಲೆಡ್ಜರ್", ta: "வரலாறு & பேரேடு", mr: "इतिहास आणि लेजर" },
    "Market Prices": { te: "మార్కెట్ ధరలు", hi: "मंडी भाव", kn: "ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು", ta: "சந்தை விலைகள்", mr: "बाजार भाव" },
    "Profile": { te: "ప్రొఫైల్", hi: "प्रोफ़ाइल", kn: "ಪ್ರೊಫೈಲ್", ta: "சுயவிவரம்", mr: "प्रोफाइल" },
    "Profile & Settings": { te: "ప్రొఫైల్ & సెట్టింగ్‌లు", hi: "प्रोफ़ाइल और सेटिंग्स", kn: "ಪ್ರೊಫೈಲ್ & ಸೆಟ್ಟಿಂಗ್‌ಗಳು", ta: "சுயவிவரம் & அமைப்புகள்", mr: "प्रोफाइल आणि सेटिंग्ज" },
    "Logout": { te: "లాగ్ అవుట్", hi: "लॉग आउट", kn: "ಲಾಗ್‌ಔಟ್", ta: "வெளியேறு", mr: "लॉग आउट" },
    "Add New Crop": { te: "కొత్త పంట జోడించండి", hi: "नई फसल जोड़ें", kn: "ಹೊಸ ಬೆಳೆ ಸೇರಿಸಿ", ta: "புதிய பயிர் சேர்க்க", mr: "नवीन पीक जोडा" },
    "Active Crops": { te: "క్రియాశీల పంటలు", hi: "सक्रिय फसलें", kn: "ಸಕ್ರಿಯ ಬೆಳೆಗಳು", ta: "செயலில் உள்ள பயிர்கள்", mr: "सक्रिय पिके" },
    "Sent Enquiries": { te: "పంపిన విచారణలు", hi: "भेजी गई पूछताछ", kn: "ಕಳುಹಿಸಿದ ವಿಚಾರಣೆಗಳು", ta: "அனுப்பிய விசாரணைகள்", mr: "पाठवलेली चौकशी" },
    "Verification QRs": { te: "ధృవీకరణ క్యూఆర్", hi: "सत्यापन क्यूआर", kn: "ಪರಿಶೀಲನಾ ಕ್ಯೂಆರ್", ta: "சரிபார்ப்பு QR", mr: "सत्यापन QR" },
    "Direct Payments": { te: "ప్రత్యక్ష చెల్లింపులు", hi: "सीधा भुगतान", kn: "ನೇರ ಪಾವತಿಗಳು", ta: "நேரடி கொடுப்பனவு", mr: "थेट पेमेंट्स" },
    "Settlements Received": { te: "అందిన చెల్లింపులు", hi: "प्राप्त भुगतान", kn: "ಸ್ವೀಕರಿಸಿದ ಪಾವತಿಗಳು", ta: "பெறப்பட்ட பணம்", mr: "प्राप्त पेमेंट्स" },
    "Scan-ready for delivery": { te: "రవాణాకు సిద్ధంగా ఉంది", hi: "डिलीवरी के लिए तैयार", kn: "ವಿತರಣೆಗೆ ಸಿದ್ಧವಾಗಿದೆ", ta: "டெலிவரிக்கு தயார்", mr: "वितरणासाठी तयार" },
    "Total Payments Received": { te: "మొత్తం అందిన చెల్లింపులు", hi: "कुल प्राप्त भुगतान", kn: "ಒಟ್ಟು ಸ್ವೀಕರಿಸಿದ ಪಾವತಿಗಳು", ta: "மொத்தம் பெறப்பட்ட தொகை", mr: "एकूण प्राप्त पेमेंट्स" },
    "Pending Settlements": { te: "పెండింగ్ చెల్లింపులు", hi: "लंबित भुगतान", kn: "ಬಾಕಿ ಪಾವತಿಗಳು", ta: "நிலுவையில் உள்ள கொடுப்பனவு", mr: "प्रलंबित पेमेंट्स" },
    "Total Weighed Produce": { te: "మొత్తం తూకం వేసిన పంట", hi: "कुल तौला गया माल", kn: "ಒಟ್ಟು ತೂಕದ ಬೆಳೆ", ta: "மொத்த எடையுள்ள விளைச்சல்", mr: "एकूण वजन केलेले पीक" },
    "Update Bank Account": { te: "బ్యాంక్ ఖాతా నవీకరణ", hi: "बैंक खाता बदलें", kn: "ಬ್ಯಾಂಕ್ ಖಾತೆ ನವೀಕರಿಸಿ", ta: "வங்கி கணக்கை புதுப்பிக்க", mr: "बँक खाते बदला" },
    "Verified for Direct Transfer": { te: "ప్రత్యక్ష బదిలీకి ధృవీకరించబడింది", hi: "प्रत्यक्ष ट्रांसफर के लिए सत्यापित", kn: "ನೇರ ವರ್ಗಾವಣೆಗೆ ದೃಢೀಕರಿಸಲಾಗಿದೆ", ta: "நேரடி பரிமாற்றத்திற்கு சரிபார்க்கப்பட்டது", mr: "थेट ट्रान्सफरसाठी सत्यापित" },
    "All Transactions": { te: "అన్ని లావాదేవీలు", hi: "सभी लेन-देन", kn: "ಎಲ್ಲಾ ವಹಿವಾಟುಗಳು", ta: "அனைத்து பரிவர்த்தனைகள்", mr: "सर्व व्यवहार" },
    "Payment Completed": { te: "చెల్లింపు పూర్తయింది", hi: "भुगतान पूर्ण", kn: "ಪಾವತಿ ಪೂರ್ಣಗೊಂಡಿದೆ", ta: "பணம் செலுத்தப்பட்டது", mr: "पेमेंट पूर्ण झाले" },
    "Payment Pending": { te: "చెల్లింపు పెండింగ్", hi: "भुगतान लंबित", kn: "ಪಾವತಿ ಬಾಕಿ ಇದೆ", ta: "பணம் நிலுவையில் உள்ளது", mr: "पेमेंट प्रलंबित" },
    "Enquiry Ref": { te: "విచారణ సంఖ్య", hi: "पूछताछ संदर्भ", kn: "ವಿಚಾರಣೆ ಸಂಖ್ಯೆ", ta: "விசாரணை எண்", mr: "चौकशी संदर्भ" },
    "Purchaser Mill": { te: "కొనుగోలు మిల్లు", hi: "खरीदार मिल", kn: "ಖರೀದಿದಾರ ಗಿರಣಿ", ta: "வாங்குபவர் ஆலை", mr: "खरेदीदार मिल" },
    "Crop & Quantity": { te: "పంట & పరిమాణం", hi: "फसल और मात्रा", kn: "ಬೆಳೆ & ಪ್ರಮಾಣ", ta: "பயிர் & அளவு", mr: "पीक आणि प्रमाण" },
    "Price / Quintal": { te: "క్వింటా ధర", hi: "भाव प्रति क्विंटल", kn: "ದರ / ಕ್ವಿಂಟಾಲ್", ta: "விலை / குவிண்டால்", mr: "दर प्रति क्विंटल" },
    "Total Amount": { te: "మొత్తం సొమ్ము", hi: "कुल राशि", kn: "ಒಟ್ಟು ಮೊತ್ತ", ta: "மொத்த தொகை", mr: "एकूण रक्कम" },
    "Status": { te: "స్థితి", hi: "स्थिति", kn: "ಸ್ಥಿತಿ", ta: "நிலை", mr: "स्थिती" },
    "Payment Date": { te: "చెల్లింపు తేదీ", hi: "भुगतान तिथि", kn: "ಪಾವತಿ ದಿನಾಂಕ", ta: "பணம் செலுத்திய தேதி", mr: "पेमेंट तारीख" },
    "Receipt": { te: "రసీదు", hi: "रसीद", kn: "ರಸೀದಿ", ta: "ரசீது", mr: "पावती" },
    "View Bill": { te: "బిల్లు చూడండి", hi: "बिल देखें", kn: "ಬಿಲ್ ವೀಕ್ಷಿಸಿ", ta: "பில் பார்க்க", mr: "बिल पहा" },
    "View Slip": { te: "స్లిప్ చూడండి", hi: "पर्ची देखें", kn: "ಸ್ಲಿಪ್ ವೀಕ್ಷಿಸಿ", ta: "ரசீது பார்க்க", mr: "पावती पहा" },
    "Close": { te: "మూసివేయి", hi: "बंद करें", kn: "ಮುಚ್ಚಿ", ta: "மூடு", mr: "बंद करा" },
    "Print": { te: "ప్రింట్", hi: "प्रिंट करें", kn: "ಮುದ್ರಿಸಿ", ta: "அச்சிடுக", mr: "प्रिंट करा" },
    "Save Profile Changes": { te: "ప్రొఫైల్ మార్పులు భద్రపరచండి", hi: "विवरण सहेजें", kn: "ಉಳಿಸಿ", ta: "சுயவிவரத்தை சேமி", mr: "बदल जतन करा" },
    "Personal & Agricultural Details": { te: "వ్యక్తిగత మరియు వ్యవసాయ వివరాలు", hi: "व्यक्तिगत एवं कृषि विवरण", kn: "ವೈಯಕ್ತಿಕ & ಕೃಷಿ ವಿವರಗಳು", ta: "தனிப்பட்ட & விவசாய விவரங்கள்", mr: "वैयक्तिक आणि कृषी तपशील" },
    "Farm & Personal Info": { te: "వ్యవసాయ & వ్యక్తిగత సమాచారం", hi: "कृषि एवं व्यक्तिगत विवरण", kn: "ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ", ta: "பண்ணை & தனிப்பட்ட தகவல்", mr: "शेती आणि वैयक्तिक माहिती" },
    "Direct Payout & Bank": { te: "బ్యాంక్ వివరాలు & చెల్లింపులు", hi: "बैंक विवरण और भुगतान", kn: "ಬ್ಯಾಂಕ್ & ಪಾವತಿಗಳು", ta: "வங்கி & கொடுப்பனவுகள்", mr: "थेट पेआउट आणि बँक" },
    "Security & PIN": { te: "భద్రత & పిన్ (PIN)", hi: "सुरक्षा और पिन (PIN)", kn: "ಭದ್ರತೆ & ಪಿನ್", ta: "பாதுகாப்பு & பின்", mr: "सुरक्षा आणि पिन" },
    "Alerts & Language": { te: "హెచ్చరికలు & భాష", hi: "अलर्ट और भाषा", kn: "ಎಚ್ಚರಿಕೆಗಳು & ಭಾಷೆ", ta: "எச்சரிக்கைகள் & மொழி", mr: "सूचना आणि भाषा" },
    "Full Name": { te: "పూర్తి పేరు", hi: "पूरा नाम", kn: "ಪೂರ್ಣ ಹೆಸರು", ta: "முழு பெயர்", mr: "पूर्ण नाव" },
    "Primary Phone (Registered)": { te: "నమోదిత ప్రాథమిక ఫోన్", hi: "पंजीकृत प्राथमिक फोन", kn: "ನೋಂದಾಯಿತ ಫೋನ್", ta: "பதிவு செய்யப்பட்ட தொலைபேசி", mr: "नोंदणीकृत फोन" },
    "WhatsApp / Alternate Phone": { te: "వాట్సాప్ / ప్రత్యామ్నాయ ఫోన్", hi: "व्हाट्सएप / वैकल्पिक फोन", kn: "ವಾಟ್ಸಾಪ್ / ಪರ್ಯಾಯ ಫೋನ್", ta: "வாட்ஸ்அப் தொலைபேசி", mr: "व्हॉट्सअॅप / पर्यायी फोन" },
    "Village / Gram Panchayat": { te: "గ్రామం / గ్రామ పంచాయితీ", hi: "गाँव / ग्राम पंचायत", kn: "ಗ್ರಾಮ / ಪಂಚಾಯತ್", ta: "கிராமம் / பஞ்சாயத்து", mr: "गाव / ग्रामपंचायत" },
    "District & State": { te: "జిల్లా & రాష్ట్రం", hi: "जिला और राज्य", kn: "ಜಿಲ್ಲೆ & ರಾಜ್ಯ", ta: "மாவட்டம் & மாநிலம்", mr: "जिल्हा आणि राज्य" },
    "Primary Farming Practice": { te: "ప్రధాన వ్యవసాయ పద్ధతి", hi: "मुख्य कृषि पद्धति", kn: "ಮುಖ್ಯ ಕೃಷಿ ಪದ್ಧತಿ", ta: "முதன்மை விவசாய முறை", mr: "प्रमुख शेती पद्धत" },
    "Total Land Holding": { te: "మొత్తం సాగు భూమి", hi: "कुल जोत भूमि", kn: "ಒಟ್ಟು ಭೂಮಿ", ta: "மொத்த நிலம்", mr: "एकूण जमीन" },
    "Registered Crops": { te: "నమోదిత పంటలు", hi: "पंजीकृत फसलें", kn: "ನೋಂದಾಯಿತ ಬೆಳೆಗಳು", ta: "பதிவு செய்யப்பட்ட பயிர்கள்", mr: "नोंदणीकृत पिके" },
    "Mill Enquiries": { te: "మిల్లు విచారణలు", hi: "मिल पूछताछ", kn: "ಗಿರಣಿ ವಿಚಾರಣೆಗಳು", ta: "ஆலை விசாரணைகள்", mr: "मिल चौकशी" },
    "KYC Status": { te: "కేవైసీ (KYC) స్థితి", hi: "केवाईसी (KYC) स्थिति", kn: "ಕೆವೈಸಿ ಸ್ಥಿತಿ", ta: "KYC நிலை", mr: "KYC स्थिती" },
    "Verified Farmer": { te: "ధృవీకరించబడిన రైతు", hi: "सत्यापित किसान", kn: "ದೃಢೀಕೃತ ರೈತ", ta: "சரிபார்க்கப்பட்ட விவசாயி", mr: "सत्यापित शेतकरी" },
    "Account Holder Name": { te: "ఖాతాదారుని పేరు", hi: "खाताधारक का नाम", kn: "ಖಾತೆದಾರರ ಹೆಸರು", ta: "கணக்கு வைத்திருப்பவர் பெயர்", mr: "खातेदाराचे नाव" },
    "Bank Name": { te: "బ్యాంక్ పేరు", hi: "बैंक का नाम", kn: "ಬ್ಯಾಂಕ್ ಹೆಸರು", ta: "வங்கி பெயர்", mr: "बँकेचे नाव" },
    "Account Number": { te: "ఖాతా సంఖ్య", hi: "खाता संख्या", kn: "ಖಾತೆ ಸಂಖ್ಯೆ", ta: "கணக்கு எண்", mr: "खाते क्रमांक" },
    "IFSC Code": { te: "ఐఎఫ్‌ఎస్‌సి (IFSC) కోడ్", hi: "आईएफएससी (IFSC) कोड", kn: "IFSC ಕೋಡ್", ta: "IFSC குறியீடு", mr: "IFSC कोड" },
    "UPI ID": { te: "యుపిఐ (UPI) ఐడీ", hi: "यूपीआई (UPI) आईडी", kn: "UPI ಐಡಿ", ta: "UPI ஐடி", mr: "UPI आयडी" },
    "Payments & Loads": { te: "చెల్లింపులు & లోడ్లు", hi: "भुगतान और लोड", kn: "ಪಾವತಿಗಳು & ಲೋಡ್ಗಳು", ta: "கொடுப்பனவுகள் & சுமைகள்", mr: "पेमेंट्स आणि लोड्स" },
    "Make Payment": { te: "చెల్లింపు చేయండి", hi: "भुगतान करें", kn: "ಪಾವತಿ ಮಾಡಿ", ta: "பணம் செலுத்துங்கள்", mr: "पेमेंट करा" },
    "Record Produce Intake": { te: "పంట రాక నమోదు", hi: "उपज आवक दर्ज करें", kn: "ದಾಸ್ತಾನು ದಾಖಲಿಸಿ", ta: "விளைச்சல் பதிவேடு", mr: "आवक नोंदवा" },
    "Actual Tonnes Received (Weighbridge)": { te: "వేబ్రిడ్జి వాస్తవ టన్నుల తూకం", hi: "वेब्रिज वास्तविक वजन (टन)", kn: "ವೇಬ್ರಿಡ್ಜ್ ತೂಕ (ಟನ್)", ta: "உண்மையான எடை (டன்)", mr: "प्रत्यक्ष वजन (टन)" },
    "Converted Quintals (1T = 10 Qtl)": { te: "మార్చిన క్వింటాళ్లు (1 టన్ను = 10 క్వింటాళ్లు)", hi: "क्विंटल में परिवर्तन (1 टन = 10 क्विंटल)", kn: "ಕ್ವಿಂಟಾಲ್ ಪರಿವರ್ತನೆ", ta: "குவிண்டால் மாற்றம்", mr: "क्विंटल रूपांतरण" },
    "Automated Bill Calculation": { te: "ఆటోమేటిక్ బిల్లు లెక్కింపు", hi: "स्वचालित बिल गणना", kn: "ಸ್ವಯಂಚಾಲಿತ ಬಿಲ್ ಲೆಕ್ಕ", ta: "தானியங்கி பில் கணக்கீடு", mr: "स्वयंचलित बिल गणना" },
    "Total Payable Amount": { te: "చెల్లించవలసిన మొత్తం", hi: "कुल देय राशि", kn: "ಒಟ್ಟು ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ", ta: "செலுத்த வேண்டிய மொத்த தொகை", mr: "एकूण देय रक्कम" },
    "Confirm Load Received": { te: "లోడ్ రసీదును నిర్ధారించండి", hi: "लोड प्राप्ति की पुष्टि करें", kn: "ಲೋಡ್ ದೃಢೀಕರಿಸಿ", ta: "சுமை ரசீதை உறுதிப்படுத்தவும்", mr: "लोड मिळाल्याची खात्री करा" },
    "Produce Intake Payment Receipt": { te: "పంట కొనుగోలు చెల్లింపు రసీదు", hi: "अनाज आवक भुगतान रसीद", kn: "ಧಾನ್ಯ ಖರೀದಿ ರಸೀದಿ", ta: "கொள்முதல் ரசீது", mr: "खरेदी पावती" },
    "Scan Gate QR": { te: "గేట్ క్యూఆర్ స్కాన్ చేయండి", hi: "गेट क्यूआर स्कैन करें", kn: "ಗೇಟ್ ಕ್ಯೂಆರ್ ಸ್ಕ್ಯಾನ್", ta: "கேட் QR ஸ்கேன்", mr: "गेट QR स्कॅन करा" }
};
Object.assign(STRING_MAP, EXTRA_PHRASES);

// Build a bidirectional canonical map so any phrase in ANY language can map cleanly to any other language
export const CANONICAL_MAP = {};

Object.keys(TRANSLATIONS.en).forEach(key => {
    Object.keys(TRANSLATIONS).forEach(lang => {
        const text = TRANSLATIONS[lang]?.[key];
        if (text && typeof text === 'string') {
            CANONICAL_MAP[text.trim()] = key;
        }
    });
});

Object.keys(EXTRA_PHRASES).forEach(enText => {
    CANONICAL_MAP[enText.trim()] = enText.trim();
    Object.keys(EXTRA_PHRASES[enText] || {}).forEach(lang => {
        const text = EXTRA_PHRASES[enText]?.[lang];
        if (text && typeof text === 'string') {
            CANONICAL_MAP[text.trim()] = enText.trim();
        }
    });
});

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(() => {
        try {
            return localStorage.getItem('kisan_language') || 'en';
        } catch {
            return 'en';
        }
    });

    const setLanguage = (langCode) => {
        setLanguageState(langCode);
        try {
            localStorage.setItem('kisan_language', langCode);

            // Manage Google Translate cookies and triggers cleanly
            const domain = window.location.hostname;
            if (langCode === 'en') {
                document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
                if (domain && domain !== 'localhost' && !domain.includes('127.0.0.1')) {
                    document.cookie = `googtrans=; path=/; domain=.${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
                    document.cookie = `googtrans=; path=/; domain=${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
                }
                document.cookie = 'googtrans=/en/en; path=/;';
            } else {
                document.cookie = `googtrans=/en/${langCode}; path=/;`;
                if (domain && domain !== 'localhost' && !domain.includes('127.0.0.1')) {
                    document.cookie = `googtrans=/en/${langCode}; path=/; domain=.${domain};`;
                }
            }

            const triggerGoogleCombo = () => {
                const combo = document.querySelector('.goog-te-combo');
                if (combo) {
                    combo.value = langCode === 'en' ? 'en' : langCode;
                    combo.dispatchEvent(new Event('change'));
                }
            };
            triggerGoogleCombo();
            setTimeout(triggerGoogleCombo, 80);
            setTimeout(triggerGoogleCombo, 250);
            setTimeout(triggerGoogleCombo, 600);

            window.dispatchEvent(new CustomEvent('kisan_language_changed', { detail: langCode }));
        } catch (e) {
            console.warn('Could not save language to localStorage:', e);
        }
    };

    // Restore language on initial page load / refresh
    useEffect(() => {
        const saved = localStorage.getItem('kisan_language');
        if (saved && saved !== 'en') {
            document.cookie = `googtrans=/en/${saved}; path=/;`;
            let attempts = 0;
            const checkCombo = setInterval(() => {
                attempts++;
                const combo = document.querySelector('.goog-te-combo');
                if (combo) {
                    combo.value = saved;
                    combo.dispatchEvent(new Event('change'));
                    clearInterval(checkCombo);
                } else if (attempts > 20) {
                    clearInterval(checkCombo);
                }
            }, 200);
        }
    }, []);

    useEffect(() => {
        const handleLangChange = (e) => {
            if (e.detail && e.detail !== language) {
                setLanguageState(e.detail);
            }
        };
        window.addEventListener('kisan_language_changed', handleLangChange);
        return () => window.removeEventListener('kisan_language_changed', handleLangChange);
    }, [language]);

    // Intelligent bidirectional translation helper:
    const t = (keyOrText, fallback = '') => {
        if (!keyOrText) return '';
        const trimmed = typeof keyOrText === 'string' ? keyOrText.trim() : '';

        // 1. Direct key match in active dictionary
        const langDict = TRANSLATIONS[language] || TRANSLATIONS.en;
        if (langDict && langDict[keyOrText] !== undefined) {
            return langDict[keyOrText];
        }

        // 2. Canonical lookup from any language to target language
        const canonicalKey = CANONICAL_MAP[trimmed];
        if (canonicalKey) {
            if (language === 'en') {
                return TRANSLATIONS.en[canonicalKey] || canonicalKey;
            }
            const translated = TRANSLATIONS[language]?.[canonicalKey] || EXTRA_PHRASES[canonicalKey]?.[language];
            if (translated) return translated;
        }

        // 3. Check STRING_MAP
        if (STRING_MAP[trimmed] && STRING_MAP[trimmed][language]) {
            return STRING_MAP[trimmed][language];
        }

        // 4. Default to English dictionary or fallback
        const defaultDict = TRANSLATIONS.en;
        if (defaultDict[keyOrText] !== undefined) {
            return defaultDict[keyOrText];
        }

        return fallback || keyOrText;
    };

    // Safe Bidirectional DOM Text & Placeholder Translator (Works in all directions including returning to English)
    useEffect(() => {
        const translateDom = () => {
            try {
                // 1. Text nodes
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                            const text = node.nodeValue.trim();
                            if (text.length > 0 && (CANONICAL_MAP[text] || STRING_MAP[text])) {
                                return NodeFilter.FILTER_ACCEPT;
                            }
                            return NodeFilter.FILTER_SKIP;
                        }
                    }
                );

                const nodesToReplace = [];
                while (walker.nextNode()) {
                    nodesToReplace.push(walker.currentNode);
                }

                nodesToReplace.forEach(node => {
                    const text = node.nodeValue.trim();
                    const key = CANONICAL_MAP[text];
                    if (key) {
                        let targetText = null;
                        if (language === 'en') {
                            targetText = TRANSLATIONS.en[key] || EXTRA_PHRASES[key]?.['en'] || key;
                        } else {
                            targetText = TRANSLATIONS[language]?.[key] || EXTRA_PHRASES[key]?.[language] || STRING_MAP[key]?.[language];
                        }
                        if (targetText && targetText !== text) {
                            node.nodeValue = node.nodeValue.replace(text, targetText);
                        }
                    } else if (STRING_MAP[text]) {
                        const targetText = language === 'en' ? text : STRING_MAP[text][language];
                        if (targetText && targetText !== text) {
                            node.nodeValue = node.nodeValue.replace(text, targetText);
                        }
                    }
                });

                // 2. Input placeholders
                document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
                    const ph = el.placeholder.trim();
                    const key = CANONICAL_MAP[ph];
                    if (key) {
                        let targetText = null;
                        if (language === 'en') {
                            targetText = TRANSLATIONS.en[key] || EXTRA_PHRASES[key]?.['en'] || key;
                        } else {
                            targetText = TRANSLATIONS[language]?.[key] || EXTRA_PHRASES[key]?.[language];
                        }
                        if (targetText && targetText !== ph) {
                            el.placeholder = targetText;
                        }
                    }
                });
            } catch (err) {
                // Silently ignore transient DOM exceptions
            }
        };

        translateDom();
        const t1 = setTimeout(translateDom, 50);
        const t2 = setTimeout(translateDom, 200);
        const t3 = setTimeout(translateDom, 500);
        const interval = setInterval(translateDom, 800);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearInterval(interval);
        };
    }, [language]);

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage,
            t,
            languages: LANGUAGES
        }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        return {
            language: 'en',
            setLanguage: () => {},
            t: (k, fb) => fb || k,
            languages: LANGUAGES
        };
    }
    return context;
}
