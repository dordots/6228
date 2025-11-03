import React, { useState, useEffect } from "react";
import { Equipment, Weapon, SerializedGear, DroneSet, Soldier, User } from "@/api/entities";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Shield, Wrench, Plane, User as UserIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import StatsCard from "../components/dashboard/StatsCard";

export default function SoldierDashboard() {
  const [equipment, setEquipment] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [gear, setGear] = useState([]);
  const [droneSets, setDroneSets] = useState([]);
  const [soldierInfo, setSoldierInfo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSoldierData();
  }, []);

  const loadSoldierData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      if (user.custom_role !== 'soldier') {
        setIsLoading(false);
        return;
      }

      // Get soldier ID
      let soldierId = user.linked_soldier_id;

      // Fallback to email/phone lookup
      if (!soldierId && user.email) {
        const soldiersByEmail = await Soldier.filter({ email: user.email });
        if (soldiersByEmail && soldiersByEmail.length > 0) {
          soldierId = soldiersByEmail[0].soldier_id;
        }
      }

      if (!soldierId && user.phoneNumber) {
        const soldiersByPhone = await Soldier.filter({ phone_number: user.phoneNumber });
        if (soldiersByPhone && soldiersByPhone.length > 0) {
          soldierId = soldiersByPhone[0].soldier_id;
        }
      }

      if (!soldierId) {
        setIsLoading(false);
        return;
      }

      // Load soldier info
      const soldiers = await Soldier.filter({ soldier_id: soldierId });
      if (soldiers && soldiers.length > 0) {
        setSoldierInfo(soldiers[0]);
      }

      // Load all equipment types in parallel
      const [myEquipment, myWeapons, myGear, myDroneSets] = await Promise.all([
        Equipment.filter({ assigned_to: soldierId }).catch(() => []),
        Weapon.filter({ assigned_to: soldierId }).catch(() => []),
        SerializedGear.filter({ assigned_to: soldierId }).catch(() => []),
        DroneSet.filter({ assigned_to: soldierId }).catch(() => [])
      ]);

      setEquipment(Array.isArray(myEquipment) ? myEquipment : []);
      setWeapons(Array.isArray(myWeapons) ? myWeapons : []);
      setGear(Array.isArray(myGear) ? myGear : []);
      setDroneSets(Array.isArray(myDroneSets) ? myDroneSets : []);

    } catch (error) {
    }
    setIsLoading(false);
  };

  const getStatusBadge = (status) => {
    if (status === 'functioning' || status === 'Operational') {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Functioning</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 border-red-200">Not Functioning</Badge>;
  };

  const totalItems = equipment.length + weapons.length + gear.length + droneSets.length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <UserIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">
                {soldierInfo
                  ? `${soldierInfo.first_name} ${soldierInfo.last_name}`
                  : currentUser?.displayName || 'My Dashboard'}
              </CardTitle>
              {soldierInfo && (
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                  <span><strong>ID:</strong> {soldierInfo.soldier_id}</span>
                  {soldierInfo.division_name && (
                    <span><strong>Division:</strong> {soldierInfo.division_name}</span>
                  )}
                  {soldierInfo.team_name && (
                    <span><strong>Team:</strong> {soldierInfo.team_name}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Equipment"
          value={equipment.length}
          icon={Package}
          color="blue"
          isLoading={isLoading}
        />
        <StatsCard
          title="Weapons"
          value={weapons.length}
          icon={Shield}
          color="red"
          isLoading={isLoading}
        />
        <StatsCard
          title="Gear"
          value={gear.length}
          icon={Wrench}
          color="green"
          isLoading={isLoading}
        />
        <StatsCard
          title="Drone Sets"
          value={droneSets.length}
          icon={Plane}
          color="amber"
          isLoading={isLoading}
        />
      </div>

      {/* No Equipment Message */}
      {!isLoading && totalItems === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No equipment currently assigned to you.
          </AlertDescription>
        </Alert>
      )}

      {/* Equipment Section */}
      {equipment.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Equipment ({equipment.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {equipment.map((item) => (
                <div
                  key={item.id || item.equipment_id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{item.equipment_type}</div>
                    {item.serial_number && (
                      <div className="text-sm text-slate-600">Serial: {item.serial_number}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(item.condition)}
                    {item.quantity && item.quantity > 1 && (
                      <Badge variant="outline">Qty: {item.quantity}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weapons Section */}
      {weapons.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              Weapons ({weapons.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {weapons.map((item) => (
                <div
                  key={item.id || item.weapon_id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{item.weapon_type}</div>
                    <div className="text-sm text-slate-600">ID: {item.weapon_id}</div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gear Section */}
      {gear.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-green-600" />
              Serialized Gear ({gear.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {gear.map((item) => (
                <div
                  key={item.id || item.gear_id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{item.gear_type}</div>
                    <div className="text-sm text-slate-600">ID: {item.gear_id}</div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drone Sets Section */}
      {droneSets.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-amber-600" />
              Drone Sets ({droneSets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {droneSets.map((item) => (
                <div
                  key={item.id || item.set_serial_number}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{item.set_type}</div>
                    <div className="text-sm text-slate-600">Serial: {item.set_serial_number}</div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
