import Layout from "./Layout.jsx";
import Login from "./Login.jsx";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import Dashboard from "./Dashboard";

import Soldiers from "./Soldiers";

import Weapons from "./Weapons";

import SerializedGear from "./SerializedGear";

import Import from "./Import";

import Equipment from "./Equipment";

import SoldierManagement from "./SoldierManagement";

import Divisions from "./Divisions";

import Maintenance from "./Maintenance";

import Drones from "./Drones";

import DroneComponents from "./DroneComponents";

import DataExport from "./DataExport";

import UserManagement from "./UserManagement";

import ArmoryDeposit from "./ArmoryDeposit";

import SoldierRelease from "./SoldierRelease";

import EquipmentTransfer from "./EquipmentTransfer";

import History from "./History";

import SecuritySettings from "./SecuritySettings";

import DailyVerification from "./DailyVerification";

import VerificationHistory from "./VerificationHistory";

import MyEquipment from "./MyEquipment";

import MyWeapons from "./MyWeapons";

import MyGear from "./MyGear";

import MyDrones from "./MyDrones";

import AccessDenied from "./AccessDenied";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Soldiers: Soldiers,
    
    Weapons: Weapons,
    
    SerializedGear: SerializedGear,
    
    Import: Import,
    
    Equipment: Equipment,
    
    SoldierManagement: SoldierManagement,
    
    Divisions: Divisions,
    
    Maintenance: Maintenance,
    
    Drones: Drones,
    
    DroneComponents: DroneComponents,
    
    DataExport: DataExport,
    
    UserManagement: UserManagement,
    
    ArmoryDeposit: ArmoryDeposit,
    
    SoldierRelease: SoldierRelease,
    
    EquipmentTransfer: EquipmentTransfer,
    
    History: History,
    
    SecuritySettings: SecuritySettings,
    
    DailyVerification: DailyVerification,
    
    VerificationHistory: VerificationHistory,
    
    MyEquipment: MyEquipment,
    
    MyWeapons: MyWeapons,
    
    MyGear: MyGear,
    
    MyDrones: MyDrones,
    
    AccessDenied: AccessDenied,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    // Login and AccessDenied routes don't need protection
    if (location.pathname === '/login' || location.pathname === '/access-denied') {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/access-denied" element={<AccessDenied />} />
            </Routes>
        );
    }
    
    // All other routes need protection
    return (
        <ProtectedRoute>
            <Layout currentPageName={currentPage}>
                <Routes>            
                    
                        <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Soldiers" element={<Soldiers />} />
                
                <Route path="/Weapons" element={<Weapons />} />
                
                <Route path="/SerializedGear" element={<SerializedGear />} />
                
                <Route path="/Import" element={<Import />} />
                
                <Route path="/Equipment" element={<Equipment />} />
                
                <Route path="/SoldierManagement" element={<SoldierManagement />} />
                
                <Route path="/Divisions" element={<Divisions />} />
                
                <Route path="/Maintenance" element={<Maintenance />} />
                
                <Route path="/Drones" element={<Drones />} />
                
                <Route path="/DroneComponents" element={<DroneComponents />} />
                
                <Route path="/DataExport" element={<DataExport />} />
                
                <Route path="/UserManagement" element={<UserManagement />} />
                
                <Route path="/ArmoryDeposit" element={<ArmoryDeposit />} />
                
                <Route path="/SoldierRelease" element={<SoldierRelease />} />
                
                <Route path="/EquipmentTransfer" element={<EquipmentTransfer />} />
                
                <Route path="/History" element={<History />} />
                
                <Route path="/SecuritySettings" element={<SecuritySettings />} />
                
                <Route path="/DailyVerification" element={<DailyVerification />} />
                
                <Route path="/VerificationHistory" element={<VerificationHistory />} />
                
                <Route path="/MyEquipment" element={<MyEquipment />} />
                
                <Route path="/MyWeapons" element={<MyWeapons />} />
                
                <Route path="/MyGear" element={<MyGear />} />
                
                <Route path="/MyDrones" element={<MyDrones />} />
                
                </Routes>
            </Layout>
        </ProtectedRoute>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}