
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Save, X, ChevronDown, Package, PackageOpen } from "lucide-react";
import ComboBox from "@/components/common/ComboBox";
import { Textarea } from "@/components/ui/textarea";
import { DroneSetType } from "@/api/entities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function SimpleSearchableSelect({ 
  label, 
  value, 
  onValueChange, 
  items = [], 
  placeholder = "Select...",
  displayField,
  valueField,
  searchFields = [],
  getItemKey
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedValue = value == null ? null : String(value);
  const selectedItem = items.find(item => {
    if (!item || !valueField) return false;
    const itemValue = item[valueField];
    if (itemValue == null) return false;
    return String(itemValue) === normalizedValue;
  });
  
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const searchLower = searchTerm.toLowerCase();
    return items.filter(item => 
      item && searchFields.some(field => 
        item[field] && String(item[field]).toLowerCase().includes(searchLower)
      )
    );
  }, [items, searchTerm, searchFields]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <div 
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer hover:bg-accent"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="flex-1">
            {selectedItem ? displayField(selectedItem) : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-hidden">
            <div className="p-2 border-b">
              <Input
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-32 overflow-y-auto">
              <div 
                className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                onClick={() => {
                  onValueChange("");
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                Unassigned
              </div>
              {filteredItems
                .map((item, index) => {
                  if (!item) return null;
                  const itemValue = valueField ? item?.[valueField] : undefined;
                  const itemKey = getItemKey
                    ? getItemKey(item, index)
                    : (itemValue != null
                        ? `${itemValue}-${item?.component_type || ""}`
                        : `${index}-${item?.component_type || "item"}`);

                  if (valueField && itemValue == null) {
                    return null;
                  }

                  return (
                    <div
                      key={itemKey}
                      className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                      onClick={() => {
                        onValueChange(itemValue != null ? String(itemValue) : "");
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      {displayField(item)}
                    </div>
                  );
                })
                .filter(Boolean)}
              {filteredItems.length === 0 && searchTerm && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No items found
                </div>
              )}
              {items.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No components available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default function DroneSetForm({
  droneSet,
  unassignedComponents = [],
  allComponents = [],
  allSoldiers = [],
  divisions = [],
  currentUser,
  onSubmit,
  onCancel
}) {
  // Check if user is division manager
  const isDivisionManager = currentUser?.custom_role === 'division_manager';
  const userDivision = currentUser?.division;

  const [droneSetTypes, setDroneSetTypes] = useState([]);
const normalizeSlotKey = (key = "") => {
  if (!key) return "";
  return key.toString().trim().toLowerCase().replace(/[\s\-]+/g, "_");
};

const canonicalSlotKey = (key = "") => {
  if (!key) return "";
  return key.toString().trim().toLowerCase().replace(/[\s_\-]+/g, "");
};

const normalizeSetType = (setType = "") => {
  return normalizeSlotKey(setType).replace(/_+/g, "_");
};

const inferSlotRole = (slotKey = "", slotLabel = "", setType = "") => {
  const normalizedSet = normalizeSetType(setType);
  const candidates = [slotKey, slotLabel];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const canonical = canonicalSlotKey(candidate);
    if (!canonical) continue;
    if (canonical.includes("goggles")) return "goggles";
    if (canonical.includes("remotecontrol") || canonical.includes("remote") || canonical.includes("controller")) return "remote_control";
    if (canonical.includes("bombdropper") || canonical.includes("dropper")) return "bomb_dropper";
    if (canonical.includes("drone")) return "drone";
    if (normalizedSet && canonical === normalizedSet) return "drone";
  }

  if (normalizedSet && canonicalSlotKey(slotKey) === normalizedSet) {
    return "drone";
  }

  return null;
};

const resolveSlotKey = (slotKey = "", setType = "", slotLabel = "") => {
  const role = inferSlotRole(slotKey, slotLabel, setType);
  const normalizedSet = normalizeSetType(setType);
  const normalizedSlot = normalizeSlotKey(slotKey);

  if (!role) return normalizedSlot || slotKey;
  if (!normalizedSet) return normalizedSlot || role;
  return `${normalizedSet}_${role}`;
};

const normalizeComponentValue = (value) => {
  if (!value) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return value.component_id || value.componentId || value.id || null;
  }
  return null;
};

const findComponentKeyForSlot = (components = {}, slotKey = "", setType = "", slotLabel = "") => {
  const targetCanonicalKeys = new Set();
  const canonicalKey = canonicalSlotKey(slotKey);
  if (canonicalKey) targetCanonicalKeys.add(canonicalKey);

  const resolvedKey = resolveSlotKey(slotKey, setType, slotLabel);
  const resolvedCanonical = canonicalSlotKey(resolvedKey);
  if (resolvedCanonical) targetCanonicalKeys.add(resolvedCanonical);

  return Object.keys(components || {}).find(existingKey => {
    const existingCanonical = canonicalSlotKey(existingKey);
    return targetCanonicalKeys.has(existingCanonical);
  }) || null;
};

const getComponentValueForSlot = (components = {}, slotKey = "", setType = "", slotLabel = "") => {
  const existingKey = findComponentKeyForSlot(components, slotKey, setType, slotLabel);
  if (!existingKey) return null;
  return components[existingKey];
};

const inferRoleFromType = (typeLower = "") => {
  if (!typeLower) return null;
  if (typeLower.includes("goggles")) return "goggles";
  if (typeLower.includes("remote")) return "remote";
  if (typeLower.includes("bomb dropper")) return "bomb_dropper";
  if (typeLower.includes("drone")) return "drone";
  return null;
};

const doesComponentMatchRequiredType = (componentTypeLower, requiredTypeLower, setTypeLower) => {
  if (!componentTypeLower || !requiredTypeLower) return false;

  if (requiredTypeLower.includes("goggles")) {
    const matchesRole = componentTypeLower.includes("goggles");
    if (!matchesRole) return false;
    if (!setTypeLower) return true;
    const hasCurrentSetType = componentTypeLower.includes(setTypeLower);
    const hasOtherSetType =
      (setTypeLower === "avetta" && componentTypeLower.includes("evo")) ||
      (setTypeLower === "evo" && componentTypeLower.includes("avetta"));
    return hasCurrentSetType || !hasOtherSetType;
  }

  if (requiredTypeLower.includes("remote")) {
    return componentTypeLower.includes("remote");
  }

  if (requiredTypeLower.includes("bomb dropper")) {
    return componentTypeLower.includes("bomb dropper") && componentTypeLower.includes("evo");
  }

  if (requiredTypeLower.includes("drone")) {
    return componentTypeLower.includes("drone") && (!setTypeLower || componentTypeLower.includes(setTypeLower));
  }

  return setTypeLower ? componentTypeLower.includes(setTypeLower) : true;
};

const normalizeComponentsMap = (components, setType, slotDefinitions = {}) => {
  if (!components || typeof components !== "object") return {};
  return Object.entries(components).reduce((acc, [slotKey, slotValue]) => {
    const normalizedValue = normalizeComponentValue(slotValue);
    const slotLabel = slotDefinitions?.[slotKey] || "";
    const normalizedKey = resolveSlotKey(slotKey, setType, slotLabel) || normalizeSlotKey(slotKey) || slotKey || "";
    acc[normalizedKey] = normalizedValue ?? null;
    return acc;
  }, {});
};

  const createInitialFormData = () => {
    if (droneSet) {
      return {
        ...droneSet,
        components: normalizeComponentsMap(droneSet.components, droneSet.set_type, droneSet.component_slots || {}),
      };
    }
    return {
      set_serial_number: "",
      set_type: "",
      status: "Operational",
      assigned_to: null,
      division_name: isDivisionManager && !droneSet ? userDivision : (droneSet?.division_name || ""),
      components: {},
      comments: "",
      armory_status: "in_deposit",
      is_sample: "false",
    };
  };

  const [formData, setFormData] = useState(createInitialFormData);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositLocation, setDepositLocation] = useState('division_deposit');
  const [depositAction, setDepositAction] = useState('deposit'); // 'deposit' or 'release'

  // Load drone set types from database
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await DroneSetType.list();
        setDroneSetTypes(Array.isArray(types) ? types : []);

        // Set default type if editing or if types are available
        if (!droneSet && types.length > 0 && !formData.set_type) {
          setFormData(prev => ({ ...prev, set_type: types[0].type_name }));
        }
      } catch (error) {
        setDroneSetTypes([]);
      }
    };
    loadTypes();
  }, [droneSet]);

  const currentComponentSlots = useMemo(() => {
    const selectedType = droneSetTypes.find(t => t.type_name === formData.set_type);
    return selectedType?.component_slots || {};
  }, [formData.set_type, droneSetTypes]);

  useEffect(() => {
    if (droneSet) {
        const normalizedDroneSet = {
          ...droneSet,
          components: normalizeComponentsMap(droneSet.components, droneSet.set_type, droneSet.component_slots || {}),
        };
        setFormData(prev => {
          console.log("[DroneSetForm] Updating form state from droneSet:", normalizedDroneSet);
          return normalizedDroneSet;
        });
    } else {
        setFormData({
            set_serial_number: "",
            set_type: "Avetta",
            status: "Operational",
            assigned_to: null,
            division_name: "",
            components: {},
            comments: "",
            armory_status: "in_deposit",
            is_sample: "false",
        });
    }
    console.log("[DroneSetForm] Form data after droneSet change:", droneSet);
  }, [droneSet]);
  
  useEffect(() => {
    if (!droneSet && formData.set_type) {
      setFormData(prev => ({ ...prev, components: {} }));
    }
  }, [formData.set_type, droneSet]);

  useEffect(() => {
    if (!currentComponentSlots || Object.keys(currentComponentSlots).length === 0) return;
    setFormData(prev => {
      const nextComponents = { ...(prev.components || {}) };
      let changed = false;
      Object.keys(currentComponentSlots).forEach(slotKey => {
        const slotLabel = currentComponentSlots[slotKey];
        const desiredKey = resolveSlotKey(slotKey, formData.set_type, slotLabel) || normalizeSlotKey(slotKey) || slotKey;
        const desiredCanonical = canonicalSlotKey(desiredKey);
        const existingKey = findComponentKeyForSlot(nextComponents, slotKey, formData.set_type, slotLabel);
        if (existingKey) {
          const existingCanonical = canonicalSlotKey(existingKey);
          if (desiredCanonical && existingCanonical !== desiredCanonical) {
            nextComponents[desiredKey] = nextComponents[existingKey];
            delete nextComponents[existingKey];
            changed = true;
          }
          return;
        }
        nextComponents[desiredKey] = null;
        changed = true;
      });
      if (changed) {
        return { ...prev, components: nextComponents };
      }
      return prev;
    });
  }, [currentComponentSlots]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      let newState = { ...prev, [field]: value };
      if (field === 'assigned_to') {
        const newSoldier = Array.isArray(allSoldiers) ? allSoldiers.find(s => s.soldier_id === value) : null;
        if (newSoldier) {
          // Soldier selected: use their division
          newState.division_name = newSoldier.division_name;
        } else {
          // Unassigned: division managers keep their division, others clear
          newState.division_name = isDivisionManager ? userDivision : "";
        }
        // Set armory_status based on assignment
        newState.armory_status = value ? "with_soldier" : "in_deposit";
      }
      return newState;
    });
  };

  const handleComponentChange = (slotKey, componentId) => {
    console.log("[DroneSetForm] Component change triggered:", { slotKey, componentId });
    setFormData(prev => ({
      ...prev,
      components: {
        ...(() => {
          const next = { ...(prev.components || {}) };
          const slotLabel = currentComponentSlots?.[slotKey];
          let targetKey = findComponentKeyForSlot(next, slotKey, formData.set_type, slotLabel);
          if (!targetKey) {
            targetKey = resolveSlotKey(slotKey, formData.set_type, slotLabel) || slotKey;
          }
          next[targetKey] = componentId || null;
          return next;
        })(),
      },
    }));
  };

  const soldierOptions = useMemo(() => {
    const options = [
      { value: '', label: 'Unassigned' },
    ];
    if (Array.isArray(allSoldiers)) {
      options.push(...allSoldiers.map(soldier => ({
        value: soldier.soldier_id,
        label: `${soldier.first_name} ${soldier.last_name} (${soldier.soldier_id})`
      })));
    }
    return options;
  }, [allSoldiers]);

  const normalizeComponentId = (component) => {
    if (!component) return null;
    return component.component_id || component.id || null;
  };

  const getAvailableComponentsForSlot = (currentSlotKey) => {
    console.log("[DroneSetForm] Calculating available components", {
      slotKey: currentSlotKey,
      formDataComponents: formData.components,
      currentComponentSlots
    });
    try {
      const requiredType = currentComponentSlots[currentSlotKey];
      if (!requiredType) return [];

      const slotCanonicalKey = canonicalSlotKey(currentSlotKey);

      const canonicalComponentMap = Object.entries(formData.components || {}).reduce((acc, [key, value]) => {
        const normalizedValue = normalizeComponentValue(value);
        const canonical = canonicalSlotKey(key);
        if (canonical && !acc.has(canonical)) {
          acc.set(canonical, { originalKey: key, value: normalizedValue });
        }
        const resolvedCanonical = canonicalSlotKey(resolveSlotKey(key, formData.set_type));
        if (resolvedCanonical && !acc.has(resolvedCanonical)) {
          acc.set(resolvedCanonical, { originalKey: key, value: normalizedValue });
        }
        return acc;
      }, new Map());

      const safeUnassigned = Array.isArray(unassignedComponents) ? unassignedComponents : [];
      console.log("[DroneSetForm] Safe unassigned components:", safeUnassigned);

      const createComponentLookup = () => {
        const map = new Map();
        const addToMap = (component) => {
          const id = normalizeComponentId(component);
          if (!id) return;
          if (!map.has(id)) {
            map.set(id, []);
          }
          map.get(id).push(component);
        };
        if (Array.isArray(allComponents)) {
          allComponents.forEach(addToMap);
        }
        safeUnassigned.forEach(addToMap);
        return map;
      };

      const componentLookup = createComponentLookup();

      const getComponentDefinition = (componentId, slotKeyForMatch) => {
        if (!componentId) return null;
        const candidates = componentLookup.get(componentId);
        if (!candidates || candidates.length === 0) return null;
        if (!slotKeyForMatch) return candidates[0];

        const requiredTypeLower = currentComponentSlots[slotKeyForMatch]?.toLowerCase?.() || "";
        const setTypeLower = formData.set_type ? formData.set_type.toLowerCase() : "";

        const matched = candidates.find(candidate => {
          const candidateTypeLower = candidate?.component_type?.toLowerCase() || "";
          return doesComponentMatchRequiredType(candidateTypeLower, requiredTypeLower, setTypeLower);
        });

        return matched || candidates[0];
      };

      const currentComponentId = getComponentValueForSlot(formData.components, currentSlotKey);
      const otherSelectedDetails = Array.from(canonicalComponentMap.entries())
        .filter(([canonicalKey, entry]) => canonicalKey !== slotCanonicalKey && entry.value)
        .map(([canonicalKey, entry]) => {
          const componentId = normalizeComponentValue(entry.value);
          const matchingSlot = Object.keys(currentComponentSlots || {}).find(slotName => canonicalSlotKey(slotName) === canonicalKey);
          const component = getComponentDefinition(componentId, matchingSlot);
          const typeFromComponent = component?.component_type?.toLowerCase() || null;
          const typeFromSlot = matchingSlot ? currentComponentSlots[matchingSlot]?.toLowerCase?.() : null;
          return {
            slotKey: matchingSlot || entry.originalKey || canonicalKey,
            componentId,
            componentType: typeFromSlot || typeFromComponent || null
          };
        })
        .filter(detail => detail.componentId);

      const currentSetComponentIds = Object.values(formData.components || {})
        .map(normalizeComponentValue)
        .filter(Boolean);
      const currentSetComponentIdSet = new Set(currentSetComponentIds);

      const candidateKey = (component) => {
        return component?.id || `${component?.component_id || ""}__${(component?.component_type || "").toLowerCase()}` || component?.component_id;
      };

      const seenCandidates = new Set();
      const candidateComponents = [];
      const addCandidate = (component) => {
        if (!component) return;
        const key = candidateKey(component);
        if (!key || seenCandidates.has(key)) return;
        seenCandidates.add(key);
        candidateComponents.push(component);
      };

      safeUnassigned.forEach(addCandidate);
      if (Array.isArray(allComponents)) {
        allComponents.forEach(addCandidate);
      }
      currentSetComponentIds.forEach(id => {
        const lookupComponent = getComponentDefinition(id, currentSlotKey) || {
          component_id: id,
          component_type: currentComponentSlots[currentSlotKey] || "Assigned Component",
          status: "Operational"
        };
        addCandidate(lookupComponent);
      });

      const debugDecisions = [];
      const available = candidateComponents.filter(c => {
        const decision = {
          componentId: c?.component_id,
          type: c?.component_type,
          include: true,
          reasons: []
        };
        debugDecisions.push(decision);

        if (!c || !c.component_type) {
          decision.include = false;
          decision.reasons.push("missing component or type");
          return false;
        }

        const selectionId = normalizeComponentId(c);
        if (!selectionId) {
          decision.include = false;
          decision.reasons.push("missing identifier");
          return false;
        }

        const componentTypeLower = c.component_type?.toLowerCase() || "";
        const conflictsWithSelected = otherSelectedDetails.some(selected => {
          if (!selected.componentId) return false;
          if (selected.componentId !== selectionId) return false;
          if (currentSetComponentIdSet.has(selectionId)) {
            return false;
          }
          if (!selected.componentType || !componentTypeLower) {
            return true;
          }
          return selected.componentType === componentTypeLower;
        });

        if (conflictsWithSelected) {
          decision.include = false;
          decision.reasons.push("already selected in another slot with same type");
          return false;
        }

        const dbComponentType = c.component_type?.toLowerCase() || "";
        const setType = formData.set_type ? formData.set_type.toLowerCase() : "";
        const requiredTypeLower = requiredType.toLowerCase();

        const matchesRole = doesComponentMatchRequiredType(dbComponentType, requiredTypeLower, setType);
        if (!matchesRole) {
          decision.include = false;
          decision.reasons.push(`type mismatch for required slot "${requiredType}"`);
          return false;
        }

        return true;
      }).map(component => {
        if (!component) return component;
        const normalizedId = component.component_id || component.id;
        return {
          ...component,
          id: normalizedId,
        };
      });

      const normalizedAvailable = Array.isArray(available) ? [...available] : [];

      if (currentComponentId) {
        const currentComponent = Array.isArray(allComponents)
          ? allComponents.find(c => {
              const normalized = normalizeComponentId(c);
              return normalized === currentComponentId || c.component_id === currentComponentId;
            })
          : null;

        const fallbackComponent = currentComponent || {
          id: currentComponentId,
          component_id: currentComponentId,
          component_type: currentComponentSlots[currentSlotKey] || "Assigned Component",
          status: "Operational"
        };

        const exists = normalizedAvailable.some(c => normalizeComponentId(c) === currentComponentId);
        if (!exists) {
          normalizedAvailable.unshift({
            ...fallbackComponent,
            id: normalizeComponentId(fallbackComponent) || currentComponentId
          });
        }
      }

      try {
        console.groupCollapsed?.(`[DroneSetForm] Slot "${currentSlotKey}" component filtering`, {
          requiredType,
          setType: formData.set_type,
          selectedComponents: formData.components
        });
        console.table?.(
          debugDecisions.map(entry => ({
            componentId: entry.componentId,
            type: entry.type,
            include: entry.include,
            reasons: entry.reasons.join("; ") || "passed"
          }))
        );
        console.log?.("[DroneSetForm] Available components after filtering:", normalizedAvailable);
        console.groupEnd?.();
      } catch (logError) {
        // Prevent logging issues from breaking the UI
      }

      return normalizedAvailable;
    } catch (error) {
      console.error("[DroneSetForm] Error calculating available components", error);
      return [];
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const finalData = { ...formData };

      // Force division assignment for division managers
      if (isDivisionManager && !finalData.division_name) {
        finalData.division_name = userDivision;
      }

      // Validate that division managers have a division
      if (isDivisionManager && !finalData.division_name) {
        alert('Error: Division managers must have a division assigned. Please contact an administrator.');
        return;
      }

      onSubmit(finalData);
    } catch (error) {
      // Error handling
    }
  };

  const handleTransferToDeposit = () => {
    setDepositAction('deposit');
    setShowDepositDialog(true);
  };

  const handleReleaseFromDeposit = () => {
    setDepositAction('release');
    setShowDepositDialog(true);
  };

  const handleConfirmDeposit = () => {
    if (depositAction === 'deposit') {
      const depositData = {
        ...formData,
        armory_status: 'in_deposit',
        deposit_location: depositLocation,
        assigned_to: null, // Unassign when transferring to deposit
      };
      onSubmit(depositData);
    } else {
      // Release from deposit
      const releaseData = {
        ...formData,
        armory_status: 'with_soldier',
        deposit_location: null, // Clear deposit location
        // Keep assigned_to as is (could be null or already assigned)
      };
      onSubmit(releaseData);
    }
    setShowDepositDialog(false);
  };

  const isWithSoldier = droneSet && (droneSet.armory_status || 'with_soldier') === 'with_soldier';
  const isInDeposit = droneSet && droneSet.armory_status === 'in_deposit';

  return (
    <>
    <form onSubmit={handleSubmit}>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="set_serial_number">Set Serial Number *</Label>
            <Input 
              id="set_serial_number" 
              value={formData.set_serial_number} 
              onChange={(e) => handleChange('set_serial_number', e.target.value)} 
              required 
              disabled={!!droneSet} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set_type">Set Type *</Label>
            {droneSetTypes.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  No drone set types available. Please create drone set types first in the "Drone Set Types" page.
                </p>
              </div>
            ) : (
              <Select value={formData.set_type} onValueChange={(value) => handleChange('set_type', value)} required>
                <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                <SelectContent>
                  {droneSetTypes.map((type) => (
                    <SelectItem key={type.id} value={type.type_name}>
                      {type.type_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Operational">Operational</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
                <SelectItem value="Missing">Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="division_name">Division</Label>
            <Select
              value={formData.division_name || (isDivisionManager ? userDivision : "")}
              onValueChange={(value) => handleChange('division_name', value)}
              disabled={isDivisionManager}
            >
              <SelectTrigger id="division_name"><SelectValue placeholder="Select a division..." /></SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                <SelectItem value={null}>No Division</SelectItem>
                {Array.isArray(divisions) && divisions.map(div => (
                  <SelectItem key={div} value={div}>{div}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDivisionManager && (
              <p className="text-xs text-slate-500">Division managers can only add drones to their own division</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assigned To</Label>
            <ComboBox
              options={soldierOptions}
              value={formData.assigned_to || ''}
              onSelect={(value) => handleChange('assigned_to', value)}
              placeholder="Select a soldier"
              searchPlaceholder="Search soldiers..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comments">Comments</Label>
          <Textarea
            id="comments"
            value={formData.comments || ""}
            onChange={(e) => handleChange('comments', e.target.value)}
            placeholder="Add any additional notes here..."
            className="h-24"
          />
        </div>

        {(currentUser?.permissions?.['equipment.assign_components'] || currentUser?.role === 'admin') && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Assign Components</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {Object.entries(currentComponentSlots).map(([key, name]) => {
                const availableComponents = getAvailableComponentsForSlot(key);
                const componentLabel = name.replace(formData.set_type, '').trim();
                const slotValue = getComponentValueForSlot(formData.components, key, formData.set_type, currentComponentSlots?.[key]) || "";
                
                return (
                  <SimpleSearchableSelect
                    key={key}
                    label={componentLabel}
                    value={slotValue}
                    onValueChange={(componentId) => handleComponentChange(key, componentId)}
                    items={availableComponents}
                    displayField={(component) => `${component.component_type} (${component.component_id})`}
                    valueField="component_id"
                    searchFields={["component_type", "component_id"]}
                    placeholder={`Select ${componentLabel}...`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-slate-50 border-t flex justify-between gap-3 p-4">
        <div>
          {droneSet && isWithSoldier && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTransferToDeposit}
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
            >
              <Package className="w-4 h-4 mr-2" />
              Transfer to Deposit
            </Button>
          )}
          {droneSet && isInDeposit && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleReleaseFromDeposit}
              className="border-green-500 text-green-700 hover:bg-green-50"
            >
              <PackageOpen className="w-4 h-4 mr-2" />
              Release from Deposit
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            {droneSet ? "Update Set" : "Create Set"}
          </Button>
        </div>
      </CardFooter>
    </form>

    {/* Deposit/Release Dialog */}
    <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {depositAction === 'deposit' ? 'Transfer to Deposit' : 'Release from Deposit'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {depositAction === 'deposit' && (
            <div className="space-y-2">
              <Label htmlFor="deposit-location">Deposit Location *</Label>
              <Select value={depositLocation} onValueChange={setDepositLocation}>
                <SelectTrigger id="deposit-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="division_deposit">Division Deposit</SelectItem>
                  <SelectItem value="armory_deposit">Armory Deposit</SelectItem>
                  <SelectItem value="naura_deposit">Naura Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-sm text-slate-600">
            {depositAction === 'deposit' 
              ? 'This will transfer the drone set to deposit and unassign it from the current soldier.'
              : 'This will release the drone set from deposit and set its status to "with soldier".'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDepositDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDeposit} 
            className={depositAction === 'deposit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {depositAction === 'deposit' ? (
              <>
                <Package className="w-4 h-4 mr-2" />
                Transfer to Deposit
              </>
            ) : (
              <>
                <PackageOpen className="w-4 h-4 mr-2" />
                Release from Deposit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
