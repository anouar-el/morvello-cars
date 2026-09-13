import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Contract, Client, DocumentType, DriverSnapshot } from '../types';
import { formatPlateFrench } from '../utils/plateUtils';
import { ClientDocumentUpload } from './ClientDocumentUpload';
import {
  User,
  Car,
  Calendar,
  Gauge,
  Fuel,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  Printer,
  FileCheck,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  Phone,
} from 'lucide-react';

export const ContractWizard: React.FC = () => {
  const {
    clients,
    drivers,
    addDriver,
    vehicles,
    addClient,
    users,
    createContract,
    updateContract,
    duplicateContractData,
    clearDuplicateData,
    editingContractData,
    clearEditingData,
    openPdfModal,
    setActiveTab,
    companySettings,
    termsVersion,
    currentUser,
    selectedVehicle,
    setSelectedVehicle,
    getClientAssignedManager,
  } = useApp();

  const isEditMode = !!editingContractData;
  const isManager = currentUser?.role === 'manager';

  // Role-based fleet filtering: Manager only sees vehicles assigned to them (and approved)
  const availableVehiclesForContract = (vehicles || []).filter((v) => {
    if (isEditMode && v.id === editingContractData?.vehicleId) return true;
    if (v.approvalStatus === 'pending_approval' || v.approvalStatus === 'rejected') return false;
    if (isManager) {
      return v.assignedManagerId === currentUser.id;
    }
    return true;
  });

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [createdContractResult, setCreatedContractResult] = useState<Contract | null>(null);

  // Form states
  // Step 1: Client Principal (Locataire)
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newClientForm, setNewClientForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '1990-01-01',
    drivingLicense: '',
    docType: 'CIN' as DocumentType,
    docNumber: '',
    phone: '',
    email: '',
    country: 'Maroc',
    address: '',
    notes: '',
    cinDocUrl: '',
    cinDocName: '',
    cinDocVersoUrl: '',
    cinDocVersoName: '',
    licenseDocUrl: '',
    licenseDocName: '',
    licenseDocVersoUrl: '',
    licenseDocVersoName: '',
  });

  // Step 1: Deuxième Conducteur (Optionnel)
  const [hasSecondDriver, setHasSecondDriver] = useState<boolean>(false);
  const [secondDriverSource, setSecondDriverSource] = useState<'driver' | 'client' | 'new'>('new');
  const [selectedSecondDriverId, setSelectedSecondDriverId] = useState<string>('');
  const [secondDriverSearchQuery, setSecondDriverSearchQuery] = useState<string>('');
  const [newSecondDriverForm, setNewSecondDriverForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '1992-05-15',
    drivingLicense: '',
    docType: 'CIN' as DocumentType,
    docNumber: '',
    phone: '',
    email: '',
  });

  // Step 2: Vehicle
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Step 3: Duration & Kilometres & Pricing
  const today = '2026-09-01';
  const nextWeek = '2026-09-08';
  const [startDate, setStartDate] = useState<string>(today);
  const [startTime, setStartTime] = useState<string>('10:00');
  const [endDate, setEndDate] = useState<string>(nextWeek);
  const [endTime, setEndTime] = useState<string>('18:00');
  const [departureKm, setDepartureKm] = useState<number>(0);
  const [departureFuel, setDepartureFuel] = useState<string>('8/8 (Plein)');
  const [pricePerDay, setPricePerDay] = useState<number>(400);
  const [depositAmount, setDepositAmount] = useState<number>(5000);
  const [contractNotes, setContractNotes] = useState<string>('');

  // Prolongation
  const [hasProlongation, setHasProlongation] = useState<boolean>(false);
  const [prolongationDate, setProlongationDate] = useState<string>('2026-09-12');
  const [prolongationTime, setProlongationTime] = useState<string>('18:00');

  // Step 3 (bis): Manager en charge & Téléphone direct (En-tête PDF)
  const [assignedManagerId, setAssignedManagerId] = useState<string>('');
  const [managerPhone, setManagerPhone] = useState<string>('');

  // Handle edit mode pre-population
  useEffect(() => {
    if (editingContractData) {
      setSelectedClientId(editingContractData.clientId);
      setClientMode('existing');
      setSelectedVehicleId(editingContractData.vehicleId);
      setStartDate(editingContractData.startDate);
      setStartTime(editingContractData.startTime || '10:00');
      setEndDate(editingContractData.endDate);
      setEndTime(editingContractData.endTime || '18:00');
      setDepartureKm(editingContractData.departureKm);
      setDepartureFuel(
        editingContractData.departureFuel ||
        editingContractData.inspection?.departureChecklist?.fuelLevel ||
        '8/8 (Plein)'
      );
      setPricePerDay(editingContractData.pricePerDay || 400);
      setDepositAmount(editingContractData.depositAmount || 5000);
      setContractNotes(editingContractData.notes || '');

      // Manager & Phone
      if (editingContractData.assignedManagerId) {
        setAssignedManagerId(editingContractData.assignedManagerId);
      }
      if (editingContractData.managerPhone) {
        setManagerPhone(editingContractData.managerPhone);
      } else if (editingContractData.assignedManagerId) {
        const m = users.find((u) => u.id === editingContractData.assignedManagerId);
        if (m?.phone) setManagerPhone(m.phone);
      }
      
      // Deuxième conducteur
      if (editingContractData.hasSecondDriver && editingContractData.secondDriverSnapshot) {
        setHasSecondDriver(true);
        setSecondDriverSource('new');
        setNewSecondDriverForm({
          firstName: editingContractData.secondDriverSnapshot.firstName,
          lastName: editingContractData.secondDriverSnapshot.lastName,
          birthDate: editingContractData.secondDriverSnapshot.birthDate || '1992-05-15',
          drivingLicense: editingContractData.secondDriverSnapshot.drivingLicense,
          docType: editingContractData.secondDriverSnapshot.docType,
          docNumber: editingContractData.secondDriverSnapshot.docNumber,
          phone: editingContractData.secondDriverSnapshot.phone,
          email: editingContractData.secondDriverSnapshot.email || '',
        });
      } else {
        setHasSecondDriver(false);
      }

      if (editingContractData.prolongation?.isActive) {
        setHasProlongation(true);
        setProlongationDate(editingContractData.prolongation.newEndDate || '2026-09-12');
        setProlongationTime(editingContractData.prolongation.newEndTime || '18:00');
      } else {
        setHasProlongation(false);
      }
    }
  }, [editingContractData]);

  // Handle duplicate data
  useEffect(() => {
    if (duplicateContractData && !editingContractData) {
      setSelectedClientId(duplicateContractData.clientId);
      setSelectedVehicleId(duplicateContractData.vehicleId);
      const veh = vehicles.find((v) => v.id === duplicateContractData.vehicleId);
      if (veh) {
        setDepartureKm(veh.currentKm);
        setPricePerDay(veh.dailyRate || 400);
      }
      if (duplicateContractData.hasSecondDriver && duplicateContractData.secondDriverSnapshot) {
        setHasSecondDriver(true);
        setSecondDriverSource('new');
        setNewSecondDriverForm({
          firstName: duplicateContractData.secondDriverSnapshot.firstName,
          lastName: duplicateContractData.secondDriverSnapshot.lastName,
          birthDate: duplicateContractData.secondDriverSnapshot.birthDate || '1992-05-15',
          drivingLicense: duplicateContractData.secondDriverSnapshot.drivingLicense,
          docType: duplicateContractData.secondDriverSnapshot.docType,
          docNumber: duplicateContractData.secondDriverSnapshot.docNumber,
          phone: duplicateContractData.secondDriverSnapshot.phone,
          email: duplicateContractData.secondDriverSnapshot.email || '',
        });
      }
      clearDuplicateData();
    }
  }, [duplicateContractData, editingContractData, vehicles, clearDuplicateData]);

  // Handle vehicle selected from Dashboard or external view
  useEffect(() => {
    if (selectedVehicle?.id && !editingContractData && !duplicateContractData) {
      setSelectedVehicleId(selectedVehicle.id);
      // Clean up selectedVehicle after pre-selection
      setSelectedVehicle(null);
    }
  }, [selectedVehicle, editingContractData, duplicateContractData, setSelectedVehicle]);

  // Sync departure KM and vehicle manager when vehicle is picked (only for non-edit mode)
  useEffect(() => {
    if (selectedVehicleId && !editingContractData) {
      const veh = vehicles.find((v) => v.id === selectedVehicleId);
      if (veh) {
        setDepartureKm(veh.currentKm);
        if (veh.dailyRate) setPricePerDay(veh.dailyRate);

        // Auto-assign vehicle's manager or current user if manager
        const targetMgrId = veh.assignedManagerId || (currentUser.role === 'manager' ? currentUser.id : '');
        if (targetMgrId) {
          setAssignedManagerId(targetMgrId);
          const mgr = users.find((u) => u.id === targetMgrId);
          setManagerPhone(mgr?.phone || companySettings.phone1);
        } else if (!assignedManagerId) {
          const firstMgr = users.find((u) => u.role === 'manager') || users[0];
          if (firstMgr) {
            setAssignedManagerId(firstMgr.id);
            setManagerPhone(firstMgr.phone || companySettings.phone1);
          }
        }
      }
    }
  }, [selectedVehicleId, vehicles, editingContractData, currentUser, users, companySettings.phone1]);

  // Compute duration in days
  const computeTotalDays = () => {
    const start = new Date(startDate);
    const end = new Date(hasProlongation ? prolongationDate : endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays || 1);
  };

  const totalDays = computeTotalDays();
  const totalAmount = totalDays * pricePerDay;

  // Selected entities
  const currentClient =
    clientMode === 'existing'
      ? clients.find((c) => c.id === selectedClientId)
      : null;

  const currentVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  // Filter clients with strict manager isolation
  const filteredClients = clients.filter((c) => {
    // Si l'utilisateur connecté est un responsable, les clients affectés à un autre responsable
    // (ex: Abdelkader Ouahib via le véhicule RENAULT KARDIAN) NE DOIVENT PAS APPARAÎTRE
    if (isManager) {
      const mgrInfo = getClientAssignedManager(c);
      if (mgrInfo.managerId && mgrInfo.managerId !== currentUser?.id) {
        return false;
      }
    }

    const q = clientSearchQuery.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      c.docNumber.toLowerCase().includes(q) ||
      c.drivingLicense.toLowerCase().includes(q)
    );
  });

  // Filter second drivers
  const filteredDrivers = drivers.filter((d) => {
    const q = secondDriverSearchQuery.toLowerCase();
    return (
      d.firstName.toLowerCase().includes(q) ||
      d.lastName.toLowerCase().includes(q) ||
      (d.phone || '').toLowerCase().includes(q) ||
      d.docNumber.toLowerCase().includes(q) ||
      d.drivingLicense.toLowerCase().includes(q)
    );
  });

  // Validation rules for steps (Phone is optional per user request)
  const isStep1Valid = () => {
    let primaryValid = false;
    if (clientMode === 'existing') {
      primaryValid = !!selectedClientId;
    } else {
      primaryValid = (
        newClientForm.firstName.trim() !== '' &&
        newClientForm.lastName.trim() !== '' &&
        newClientForm.docNumber.trim() !== '' &&
        newClientForm.drivingLicense.trim() !== ''
      );
    }

    if (!primaryValid) return false;

    if (hasSecondDriver) {
      if (secondDriverSource === 'driver' || secondDriverSource === 'client') {
        return !!selectedSecondDriverId;
      }
      return (
        newSecondDriverForm.firstName.trim() !== '' &&
        newSecondDriverForm.lastName.trim() !== '' &&
        newSecondDriverForm.docNumber.trim() !== '' &&
        newSecondDriverForm.drivingLicense.trim() !== ''
      );
    }

    return true;
  };

  const isStep2Valid = () => {
    if (!selectedVehicleId) return false;
    if (isEditMode && selectedVehicleId === editingContractData?.vehicleId) return true;
    return currentVehicle?.status === 'available';
  };

  const isStep3Valid = () => {
    if (!startDate || !endDate || !startTime || !endTime) return false;
    if (departureKm < 0) return false;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (end < start) return false;
    if (hasProlongation) {
      const prol = new Date(prolongationDate).getTime();
      if (prol < end) return false;
    }
    return true;
  };

  // Final submission
  const handleFinalSubmit = () => {
    // 1. Resolve client
    let finalClient: Client;
    if (clientMode === 'new') {
      finalClient = addClient(newClientForm);
    } else {
      finalClient = currentClient!;
    }

    // 2. Prepare snapshots
    const clientSnapshot = {
      id: finalClient.id,
      firstName: finalClient.firstName,
      lastName: finalClient.lastName,
      birthDate: finalClient.birthDate,
      drivingLicense: finalClient.drivingLicense,
      docType: finalClient.docType,
      docNumber: finalClient.docNumber,
      phone: finalClient.phone,
      email: finalClient.email,
      address: finalClient.address,
      country: finalClient.country,
      cinDocUrl: finalClient.cinDocUrl,
      cinDocName: finalClient.cinDocName,
      cinDocVersoUrl: finalClient.cinDocVersoUrl,
      cinDocVersoName: finalClient.cinDocVersoName,
      licenseDocUrl: finalClient.licenseDocUrl,
      licenseDocName: finalClient.licenseDocName,
      licenseDocVersoUrl: finalClient.licenseDocVersoUrl,
      licenseDocVersoName: finalClient.licenseDocVersoName,
      documents: finalClient.documents,
    };

    // 2.B Prepare Second Driver Snapshot if applicable
    let secondDriverSnapshot: DriverSnapshot | undefined = undefined;
    if (hasSecondDriver) {
      if (secondDriverSource === 'driver') {
        const drv = drivers.find((d) => d.id === selectedSecondDriverId);
        if (drv) {
          secondDriverSnapshot = {
            firstName: drv.firstName,
            lastName: drv.lastName,
            birthDate: drv.birthDate,
            drivingLicense: drv.drivingLicense,
            docType: drv.docType,
            docNumber: drv.docNumber,
            phone: drv.phone,
            email: drv.email,
          };
        }
      } else if (secondDriverSource === 'client') {
        const cl = clients.find((c) => c.id === selectedSecondDriverId);
        if (cl) {
          secondDriverSnapshot = {
            firstName: cl.firstName,
            lastName: cl.lastName,
            birthDate: cl.birthDate,
            drivingLicense: cl.drivingLicense,
            docType: cl.docType,
            docNumber: cl.docNumber,
            phone: cl.phone,
            email: cl.email,
          };
        }
      } else {
        secondDriverSnapshot = {
          firstName: newSecondDriverForm.firstName.trim(),
          lastName: newSecondDriverForm.lastName.trim(),
          birthDate: newSecondDriverForm.birthDate,
          drivingLicense: newSecondDriverForm.drivingLicense.trim(),
          docType: newSecondDriverForm.docType,
          docNumber: newSecondDriverForm.docNumber.trim(),
          phone: newSecondDriverForm.phone.trim(),
          email: newSecondDriverForm.email?.trim() || '',
        };
        // Sauvegarder dans le répertoire des conducteurs
        addDriver({
          firstName: newSecondDriverForm.firstName.trim(),
          lastName: newSecondDriverForm.lastName.trim(),
          birthDate: newSecondDriverForm.birthDate,
          drivingLicense: newSecondDriverForm.drivingLicense.trim(),
          docType: newSecondDriverForm.docType,
          docNumber: newSecondDriverForm.docNumber.trim(),
          phone: newSecondDriverForm.phone.trim(),
          email: newSecondDriverForm.email?.trim() || '',
          notes: 'Ajouté comme 2ème conducteur de contrat',
        });
      }
    }

    const vehicleSnapshot = {
      id: currentVehicle!.id,
      brand: currentVehicle!.brand,
      model: currentVehicle!.model,
      plate: formatPlateFrench(currentVehicle!.plate),
      fuelType: currentVehicle!.fuelType,
    };

    // 3. Update or Create contract
    const resolvedManagerObj = users.find((u) => u.id === assignedManagerId) ||
      (currentVehicle?.assignedManagerId ? users.find((u) => u.id === currentVehicle.assignedManagerId) : undefined);
    const resolvedManagerPhone = managerPhone.trim() || resolvedManagerObj?.phone || companySettings.phone1;

    if (isEditMode && editingContractData) {
      const updated = updateContract(editingContractData.id, {
        clientId: finalClient.id,
        clientSnapshot,
        hasSecondDriver,
        secondDriverSnapshot,
        vehicleId: currentVehicle!.id,
        vehicleSnapshot,
        assignedManagerId: assignedManagerId || currentVehicle?.assignedManagerId,
        assignedManagerName: resolvedManagerObj?.name || currentVehicle?.assignedManagerName,
        managerPhone: resolvedManagerPhone,
        startDate,
        startTime,
        endDate,
        endTime,
        departureKm,
        departureFuel,
        prolongation: {
          isActive: hasProlongation,
          newEndDate: hasProlongation ? prolongationDate : '',
          newEndTime: hasProlongation ? prolongationTime : '',
        },
        totalDays,
        pricePerDay,
        totalAmount,
        depositAmount,
        notes: contractNotes,
      });

      setCreatedContractResult(
        updated || {
          ...editingContractData,
          clientId: finalClient.id,
          clientSnapshot,
          hasSecondDriver,
          secondDriverSnapshot,
          vehicleId: currentVehicle!.id,
          vehicleSnapshot,
          assignedManagerId: assignedManagerId || currentVehicle?.assignedManagerId,
          assignedManagerName: resolvedManagerObj?.name || currentVehicle?.assignedManagerName,
          managerPhone: resolvedManagerPhone,
          startDate,
          startTime,
          endDate,
          endTime,
          departureKm,
          departureFuel,
          prolongation: {
            isActive: hasProlongation,
            newEndDate: hasProlongation ? prolongationDate : '',
            newEndTime: hasProlongation ? prolongationTime : '',
          },
          totalDays,
          pricePerDay,
          totalAmount,
          depositAmount,
          notes: contractNotes,
        }
      );
      clearEditingData();
      return;
    }

    const newContract = createContract({
      status: 'active',
      clientId: finalClient.id,
      clientSnapshot,
      hasSecondDriver,
      secondDriverSnapshot,
      vehicleId: currentVehicle!.id,
      vehicleSnapshot,
      assignedManagerId: assignedManagerId || currentVehicle?.assignedManagerId,
      assignedManagerName: resolvedManagerObj?.name || currentVehicle?.assignedManagerName,
      managerPhone: resolvedManagerPhone,
      startDate,
      startTime,
      endDate,
      endTime,
      departureKm,
      departureFuel,
      prolongation: {
        isActive: hasProlongation,
        newEndDate: hasProlongation ? prolongationDate : '',
        newEndTime: hasProlongation ? prolongationTime : '',
      },
      termsVersion: termsVersion.version,
      totalDays,
      pricePerDay,
      totalAmount,
      depositAmount,
      notes: contractNotes,
    });

    setCreatedContractResult(newContract);
  };

  // SUCCESS BANNER / MODAL STEP
  if (createdContractResult) {
    return (
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">
          {isEditMode ? '✓ Contrat Modifié & Enregistré avec Succès' : '✓ Contrat Créé & Archivé avec Succès'}
        </span>

        <h2 className="text-3xl font-extrabold text-white mt-1 font-mono tracking-wider">
          {createdContractResult.contractNumber}
        </h2>

        <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto">
          {isEditMode
            ? `Les modifications du contrat ${createdContractResult.contractNumber} ont été enregistrées avec succès dans l'historique et la maquette A4.`
            : `Le contrat a été généré sur 2 pages A4 exactes avec les conditions générales V${createdContractResult.termsVersion} et le véhicule a été assigné au statut Loué.`}
        </p>

        {/* Snapshot Summary Box */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 my-6 text-left text-xs grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <span className="text-slate-400 block">Locataire :</span>
            <span className="font-bold text-white uppercase">
              {createdContractResult.clientSnapshot.lastName} {createdContractResult.clientSnapshot.firstName}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Véhicule :</span>
            <span className="font-bold text-amber-400">
              {createdContractResult.vehicleSnapshot.brand} {createdContractResult.vehicleSnapshot.model}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Immatriculation :</span>
            <span className="font-bold font-mono text-white">
              {createdContractResult.vehicleSnapshot.plate}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">KM Départ :</span>
            <span className="font-bold font-mono text-white">
              {createdContractResult.departureKm.toLocaleString()} KM
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Carburant Départ :</span>
            <span className="font-bold font-mono text-amber-400">
              {createdContractResult.departureFuel || '8/8 (Plein)'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => openPdfModal(createdContractResult)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 transition-transform active:scale-95 text-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimer pour Signature
          </button>

          <button
            onClick={() => {
              clearEditingData();
              setActiveTab('contracts');
            }}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium px-4 py-2.5 rounded-xl border border-slate-700/80 transition-colors text-sm cursor-pointer"
          >
            <FileCheck className="w-4 h-4" />
            Retour à la liste des contrats
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 1, label: 'Locataire / Client', icon: <User className="w-4 h-4" /> },
    { id: 2, label: 'Véhicule', icon: <Car className="w-4 h-4" /> },
    { id: 3, label: 'Durée & Tarification', icon: <Calendar className="w-4 h-4" /> },
    { id: 4, label: 'Récapitulatif & Validation', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* HEADER & STEPS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        {isEditMode && editingContractData ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-950 bg-amber-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  Mode Modification
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Créé le {new Date(editingContractData.createdAt).toLocaleDateString('fr-FR')} par {editingContractData.createdBy}
                </span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight mt-1">
                Modifier le Contrat N° <span className="font-mono text-amber-400">{editingContractData.contractNumber}</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Modifiez les dates, le locataire, le véhicule ou les conditions tarifaires de ce contrat.
              </p>
            </div>
            <button
              onClick={() => {
                clearEditingData();
                setActiveTab('contracts');
              }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
            >
              Annuler la modification
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-4">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">
                Parcours de Création • Morvello Cars V1
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">Nouveau Contrat de Location</h1>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
              <span>N° automatique généré :</span>
              <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded font-bold border border-slate-700">
                {companySettings.contractPrefix}-{companySettings.contractYear}-{String(companySettings.nextContractNumber).padStart(4, '0')}
              </span>
            </div>
          </div>
        )}

        {/* STEPPER */}
        <div className="grid grid-cols-4 gap-2">
          {steps.map((s) => {
            const isCompleted = s.id < currentStep;
            const isCurrent = s.id === currentStep;
            return (
              <div
                key={s.id}
                className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : isCompleted
                    ? 'bg-slate-800/60 border-slate-700 text-emerald-400'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 text-xs font-bold ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? '✓' : s.id}
                </div>
                <span className="text-[11px] font-semibold hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[420px] flex flex-col justify-between">
        {/* ========================================================================= */}
        {/* STEP 1: CLIENT PRINCIPAL (LOCATAIRE)                                      */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-400" />
                  Étape 1 : Sélection ou Création du Locataire (Conducteur)
                </h2>
                <p className="text-xs text-slate-400">
                  Le locataire sera le signataire principal et responsable contractuel du véhicule.
                </p>
              </div>

              {/* Mode Toggle: Existant vs Nouveau */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setClientMode('existing')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    clientMode === 'existing'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Client Existant
                </button>
                <button
                  onClick={() => setClientMode('new')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    clientMode === 'new'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + Nouveau Client
                </button>
              </div>
            </div>

            {/* OPTION A: CLIENT EXISTANT */}
            {clientMode === 'existing' ? (
              <div className="space-y-3">
                {/* Search bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom, téléphone, C.I.N / Passeport, ou permis..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Client cards selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                  {filteredClients.map((client) => {
                    const isSelected = selectedClientId === client.id;
                    return (
                      <div
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xs font-bold text-white uppercase">
                              {client.lastName} {client.firstName}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {client.docType} : <span className="text-slate-200 font-mono">{client.docNumber}</span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Permis : <span className="text-slate-200 font-mono">{client.drivingLicense}</span>
                            </p>
                            <p className="text-[11px] text-amber-400 font-mono mt-1">
                              Tél : {client.phone || 'Non renseigné'}
                            </p>
                            {(client.licenseDocUrl || client.cinDocUrl) && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono mt-1 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                ✓ Documents numérisés
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="text-xs bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                              ✓ Sélectionné
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* OPTION B: NOUVEAU CLIENT */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Prénom *</label>
                  <input
                    type="text"
                    value={newClientForm.firstName}
                    onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
                    placeholder="Ex: Mehdi"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nom de famille *</label>
                  <input
                    type="text"
                    value={newClientForm.lastName}
                    onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
                    placeholder="Ex: Alami"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Date de naissance</label>
                  <input
                    type="date"
                    value={newClientForm.birthDate}
                    onChange={(e) => setNewClientForm({ ...newClientForm, birthDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Type de document *</label>
                  <select
                    value={newClientForm.docType}
                    onChange={(e) => setNewClientForm({ ...newClientForm, docType: e.target.value as DocumentType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CIN">C.I.N (Carte d'Identité Nationale)</option>
                    <option value="Passeport">Passeport International</option>
                    <option value="Carte de Séjour">Carte de Séjour</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">N° de document (CIN / Passeport) *</label>
                  <input
                    type="text"
                    value={newClientForm.docNumber}
                    onChange={(e) => setNewClientForm({ ...newClientForm, docNumber: e.target.value })}
                    placeholder="Ex: BJ981240"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">N° Permis de conduire *</label>
                  <input
                    type="text"
                    value={newClientForm.drivingLicense}
                    onChange={(e) => setNewClientForm({ ...newClientForm, drivingLicense: e.target.value })}
                    placeholder="Ex: B-492019/14"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    Téléphone / GSM <span className="text-slate-500 font-normal">(Facultatif)</span>
                  </label>
                  <input
                    type="tel"
                    value={newClientForm.phone}
                    onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    placeholder="Ex: +212 661-000000 (Optionnel)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Email (Facultatif)</label>
                  <input
                    type="email"
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    placeholder="client@gmail.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Pays / Ville de résidence</label>
                  <input
                    type="text"
                    value={newClientForm.country}
                    onChange={(e) => setNewClientForm({ ...newClientForm, country: e.target.value })}
                    placeholder="Maroc • Casablanca"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-slate-400 mb-1 font-medium">Adresse complète</label>
                  <input
                    type="text"
                    value={newClientForm.address}
                    onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
                    placeholder="Ex: Boulevard d'Anfa, Résidence Les Fleurs, Casablanca"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* TÉLÉVERSEMENT DES DOCUMENTS (PERMIS & CIN/PASSEPORT) - FACULTATIF */}
                <div className="sm:col-span-3 pt-2">
                  <ClientDocumentUpload
                    cinRecto={newClientForm.cinDocUrl ? { dataUrl: newClientForm.cinDocUrl, name: newClientForm.cinDocName } : undefined}
                    cinVerso={newClientForm.cinDocVersoUrl ? { dataUrl: newClientForm.cinDocVersoUrl, name: newClientForm.cinDocVersoName } : undefined}
                    licenseRecto={newClientForm.licenseDocUrl ? { dataUrl: newClientForm.licenseDocUrl, name: newClientForm.licenseDocName } : undefined}
                    licenseVerso={newClientForm.licenseDocVersoUrl ? { dataUrl: newClientForm.licenseDocVersoUrl, name: newClientForm.licenseDocVersoName } : undefined}
                    onChange={(docs) => setNewClientForm((prev) => ({ ...prev, ...docs }))}
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SOUS-SECTION : CONDUCTEUR SECONDAIRE (OPTIONNEL)                          */}
            {/* ========================================================================= */}
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        Conducteur Secondaire Agréé
                        <span className="text-[10px] text-amber-400 font-arabic font-normal">السائق الثاني الإضافي</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Ajoutez un deuxième conducteur autorisé à conduire le véhicule sous ce contrat.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-600 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={hasSecondDriver}
                      onChange={(e) => setHasSecondDriver(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 relative"></div>
                    <span className="text-xs font-semibold text-slate-200">
                      {hasSecondDriver ? 'Activé (2 Conducteurs)' : 'Aucun (1 seul)'}
                    </span>
                  </label>
                </div>

                {/* Second Driver Form (Conditional) */}
                {hasSecondDriver && (
                  <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 space-y-3 animate-in fade-in zoom-in-98 duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <span className="text-[11px] font-semibold text-amber-300">
                        Informations du 2ème Conducteur :
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSecondDriverSource('driver')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            secondDriverSource === 'driver'
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Carnet Conducteurs ({drivers.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSecondDriverSource('client')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            secondDriverSource === 'client'
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Depuis Clients ({clients.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSecondDriverSource('new')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            secondDriverSource === 'new'
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          + Nouveau
                        </button>
                      </div>
                    </div>

                    {/* Source: Drivers Repertoire */}
                    {secondDriverSource === 'driver' && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            value={secondDriverSearchQuery}
                            onChange={(e) => setSecondDriverSearchQuery(e.target.value)}
                            placeholder="Rechercher conducteur existant par nom, CIN, téléphone..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {filteredDrivers.map((drv) => {
                            const isSelected = selectedSecondDriverId === drv.id;
                            return (
                              <div
                                key={drv.id}
                                onClick={() => setSelectedSecondDriverId(drv.id)}
                                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between ${
                                  isSelected
                                    ? 'bg-amber-500/15 border-amber-500 text-white'
                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                                }`}
                              >
                                <div>
                                  <div className="font-bold uppercase text-white">
                                    {drv.lastName} {drv.firstName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {drv.docType} : {drv.docNumber} • Permis : {drv.drivingLicense}
                                  </div>
                                  <div className="text-[10px] text-amber-400 mt-0.5">
                                    📞 {drv.phone}
                                  </div>
                                </div>
                                {isSelected && <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />}
                              </div>
                            );
                          })}
                          {filteredDrivers.length === 0 && (
                            <p className="col-span-2 text-center text-slate-500 text-[11px] py-3">
                              Aucun conducteur trouvé. Choisissez "+ Nouveau" pour en saisir un.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Source: Clients Repertoire */}
                    {secondDriverSource === 'client' && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            value={secondDriverSearchQuery}
                            onChange={(e) => setSecondDriverSearchQuery(e.target.value)}
                            placeholder="Rechercher client existant..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {clients
                            .filter((c) => {
                              if (clientMode === 'existing' && c.id === selectedClientId) return false;
                              if (isManager) {
                                const mgrInfo = getClientAssignedManager(c);
                                if (mgrInfo.managerId && mgrInfo.managerId !== currentUser?.id) {
                                  return false;
                                }
                              }
                              const q = secondDriverSearchQuery.toLowerCase();
                              return (
                                c.firstName.toLowerCase().includes(q) ||
                                c.lastName.toLowerCase().includes(q) ||
                                c.docNumber.toLowerCase().includes(q)
                              );
                            })
                            .map((cl) => {
                              const isSelected = selectedSecondDriverId === cl.id;
                              return (
                                <div
                                  key={cl.id}
                                  onClick={() => setSelectedSecondDriverId(cl.id)}
                                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between ${
                                    isSelected
                                      ? 'bg-amber-500/15 border-amber-500 text-white'
                                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                                  }`}
                                >
                                  <div>
                                    <div className="font-bold uppercase text-white">
                                      {cl.lastName} {cl.firstName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      {cl.docType} : {cl.docNumber} • Permis : {cl.drivingLicense}
                                    </div>
                                    <div className="text-[10px] text-amber-400 mt-0.5">
                                      📞 {cl.phone}
                                    </div>
                                  </div>
                                  {isSelected && <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Source: New Second Driver Form */}
                    {secondDriverSource === 'new' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">Prénom *</label>
                          <input
                            type="text"
                            value={newSecondDriverForm.firstName}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, firstName: e.target.value })}
                            placeholder="Ex: Karim"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">Nom de famille *</label>
                          <input
                            type="text"
                            value={newSecondDriverForm.lastName}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, lastName: e.target.value })}
                            placeholder="Ex: Bennani"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">Date de naissance</label>
                          <input
                            type="date"
                            value={newSecondDriverForm.birthDate}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, birthDate: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">Type de document *</label>
                          <select
                            value={newSecondDriverForm.docType}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, docType: e.target.value as DocumentType })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                          >
                            <option value="CIN">C.I.N</option>
                            <option value="Passeport">Passeport</option>
                            <option value="Carte de Séjour">Carte de Séjour</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">N° Document (CIN / Passeport) *</label>
                          <input
                            type="text"
                            value={newSecondDriverForm.docNumber}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, docNumber: e.target.value })}
                            placeholder="Ex: BK771234"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white uppercase font-mono focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">N° Permis de conduire *</label>
                          <input
                            type="text"
                            value={newSecondDriverForm.drivingLicense}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, drivingLicense: e.target.value })}
                            placeholder="Ex: B-998811/18"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">
                            Téléphone / GSM <span className="text-slate-500 font-normal">(Facultatif)</span>
                          </label>
                          <input
                            type="tel"
                            value={newSecondDriverForm.phone}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, phone: e.target.value })}
                            placeholder="Ex: +212 662-112233 (Optionnel)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-400 mb-1 font-medium text-[11px]">Email (Facultatif)</label>
                          <input
                            type="email"
                            value={newSecondDriverForm.email}
                            onChange={(e) => setNewSecondDriverForm({ ...newSecondDriverForm, email: e.target.value })}
                            placeholder="conducteur2@gmail.com"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: VÉHICULE & DISPONIBILITÉ                                          */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Car className="w-5 h-5 text-amber-400" />
                  Étape 2 : Attribution du Véhicule
                </h2>
                <p className="text-xs text-slate-400">
                  Sélectionnez le véhicule à attribuer pour ce contrat. Le relevé kilométrique et tarif sont auto-synchronisés.
                </p>
              </div>

              {isManager ? (
                <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg font-mono">
                  Flotte Responsable : {currentUser.assignedFleetName || currentUser.name}
                </span>
              ) : (
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-mono">
                  Vue Super Admin (Flotte globale)
                </span>
              )}
            </div>

            {/* MANAGER FLEET NOTICE */}
            {isManager && (
              <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Véhicules assignés à votre gestion :</strong> Vous ne pouvez contracter que sur les véhicules rattachés à votre sous-flotte ({availableVehiclesForContract.length} véhicule(s) éligible(s)).
                </span>
              </div>
            )}

            {availableVehiclesForContract.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/60 border border-slate-800 rounded-xl p-6">
                <Car className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
                <h3 className="text-sm font-bold text-slate-300">Aucun véhicule disponible dans votre flotte</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Aucun véhicule n'est actuellement affecté à votre profil ou disponible à la location. Contactez le Super Admin / Gérant pour vous affecter des véhicules.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {availableVehiclesForContract.map((veh) => {
                  const isCurrentContractVehicle = isEditMode && veh.id === editingContractData?.vehicleId;
                  const isAvailable = veh.status === 'available' || isCurrentContractVehicle;
                  const isSelected = selectedVehicleId === veh.id;

                  return (
                    <div
                      key={veh.id}
                      onClick={() => {
                        if (isAvailable) setSelectedVehicleId(veh.id);
                      }}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10 cursor-pointer'
                          : isAvailable
                          ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700 cursor-pointer'
                          : 'bg-slate-950/30 border-slate-900 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-white uppercase">{veh.brand}</h3>
                            <span className="text-[10px] text-slate-400">{veh.model}</span>
                          </div>
                          <p className="text-xs font-mono font-bold text-amber-400 mt-1 tracking-wider">
                            {formatPlateFrench(veh.plate)}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Carburant : <span className="text-slate-200">{veh.fuelType}</span> • KM actuel :{' '}
                            <span className="font-mono text-slate-200">{veh.currentKm.toLocaleString()} KM</span>
                          </p>
                          {veh.assignedManagerName && (
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                              <UserCheck className="w-3 h-3 text-amber-400" />
                              {veh.assignedManagerName}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          {isCurrentContractVehicle && (
                            <span className="inline-block bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                              Véhicule Actuel
                            </span>
                          )}
                          {!isCurrentContractVehicle && veh.status === 'available' && (
                            <span className="inline-block bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Disponible
                            </span>
                          )}
                          {!isCurrentContractVehicle && veh.status === 'rented' && (
                            <span className="inline-block bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Déjà Loué
                            </span>
                          )}
                          {!isCurrentContractVehicle && veh.status === 'maintenance' && (
                            <span className="inline-block bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Maintenance
                            </span>
                          )}

                          {isSelected && (
                            <span className="block mt-2 text-emerald-400 text-xs font-bold">
                              ✓ Assigné
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: DURÉE, KILOMÉTRAGE & TARIFICATION                                 */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Étape 3 : Durée de la Location, Kilométrage Départ & Tarification
              </h2>
              <p className="text-xs text-slate-400">
                Définissez les dates et heures de sortie/retour, le relevé compteur et les montants financiers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* DÉPART */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
                  <span className="uppercase text-[11px]">Date & Heure de Sortie (Départ)</span>
                  <span className="text-[10px] font-arabic">تاريخ وساعة الخروج</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Date départ *</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Heure départ *</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">KM Départ (Relevé compteur) *</label>
                    <div className="relative">
                      <Gauge className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="number"
                        value={departureKm}
                        onChange={(e) => setDepartureKm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Carburant au Départ *</label>
                    <div className="relative">
                      <Fuel className="w-4 h-4 absolute left-3 top-2.5 text-amber-400" />
                      <select
                        value={departureFuel}
                        onChange={(e) => setDepartureFuel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
                      >
                        <option value="8/8 (Plein)">8/8 (Plein complet)</option>
                        <option value="7/8">7/8</option>
                        <option value="6/8 (3/4)">6/8 (3/4)</option>
                        <option value="5/8">5/8</option>
                        <option value="4/8 (1/2)">4/8 (1/2)</option>
                        <option value="3/8">3/8</option>
                        <option value="2/8 (1/4)">2/8 (1/4)</option>
                        <option value="1/8 (Réserve)">1/8 (Réserve)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* RETOUR */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1.5">
                  <span className="uppercase text-[11px]">Date & Heure de Restitution (Retour)</span>
                  <span className="text-[10px] font-arabic">تاريخ وساعة الدخول</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Date retour *</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Heure retour *</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Prix par jour (MAD)</label>
                    <input
                      type="number"
                      value={pricePerDay}
                      onChange={(e) => setPricePerDay(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Caution (MAD)</label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PROLONGATION TOGGLE */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-white font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasProlongation}
                    onChange={(e) => setHasProlongation(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>Activer une Prolongation de contrat (التمديد)</span>
                </label>
                <span className="text-[10px] text-slate-500">Ne modifie pas silencieusement la date initiale</span>
              </div>

              {hasProlongation && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Nouvelle date d'échéance</label>
                    <input
                      type="date"
                      value={prolongationDate}
                      onChange={(e) => setProlongationDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Nouvelle heure d'échéance</label>
                    <input
                      type="time"
                      value={prolongationTime}
                      onChange={(e) => setProlongationTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* MANAGER RÉFÉRENT & TÉLÉPHONE DIRECT (POUR L'EN-TÊTE DU CONTRAT PDF) */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span className="uppercase text-[11px]">Manager Référent &amp; Téléphone Direct (En-tête PDF)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Personnalisation Contrat</span>
              </div>

              <p className="text-[11px] text-slate-400">
                Le numéro de téléphone ci-dessous s'imprimera directement sur l'en-tête et le pied de page de la 1ère page du contrat PDF pour que le client joigne immédiatement son responsable attitré.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium text-xs">
                    Collaborateur / Manager en charge *
                  </label>
                  <select
                    value={assignedManagerId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setAssignedManagerId(newId);
                      const mgr = users.find((u) => u.id === newId);
                      if (mgr?.phone) {
                        setManagerPhone(mgr.phone);
                      } else {
                        setManagerPhone(companySettings.phone1);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Sélectionner un responsable...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role.toUpperCase()}) {u.phone ? `• ${u.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium text-xs flex items-center justify-between">
                    <span>Numéro de Téléphone Direct imprimé</span>
                    <span className="text-[10px] text-amber-400 font-mono">Modifiable</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      placeholder="Ex: +212 661-458920"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-amber-300 font-mono text-xs font-bold focus:border-amber-500 focus:outline-none"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>

            {/* SUMMARY STATS ROW */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="text-slate-400">
                Durée calculée : <strong className="text-white text-sm font-mono">{totalDays} jour(s)</strong>
              </div>
              <div className="text-slate-400">
                Montant total estimé :{' '}
                <strong className="text-amber-400 text-sm font-mono">{totalAmount.toLocaleString()} MAD</strong>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: RÉCAPITULATIF & VALIDATION FINALE                                 */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Étape 4 : Récapitulatif & Validation Avant Génération A4
                </h2>
                <p className="text-xs text-slate-400">
                  Vérifiez attentivement les données du contrat avant de générer le document officiel 2 pages.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-1 rounded">
                Conditions V{termsVersion.version}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* LOCATAIRE & CONDUCTEURS SUMMARY */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  1. Locataire & Conducteurs
                </h3>
                <div className="space-y-1 text-slate-300">
                  <p>
                    Locataire Principal :{' '}
                    <strong className="text-white uppercase">
                      {clientMode === 'existing'
                        ? `${currentClient?.lastName} ${currentClient?.firstName}`
                        : `${newClientForm.lastName} ${newClientForm.firstName}`}
                    </strong>
                  </p>
                  <p>
                    Document :{' '}
                    <span className="font-mono text-white">
                      {clientMode === 'existing' ? currentClient?.docNumber : newClientForm.docNumber} (
                      {clientMode === 'existing' ? currentClient?.docType : newClientForm.docType})
                    </span>
                  </p>
                  <p>
                    Permis :{' '}
                    <span className="font-mono text-white">
                      {clientMode === 'existing' ? currentClient?.drivingLicense : newClientForm.drivingLicense}
                    </span>
                  </p>
                  <p>
                    Téléphone :{' '}
                    <span className="text-amber-400">
                      {(clientMode === 'existing' ? currentClient?.phone : newClientForm.phone) || (
                        <span className="text-slate-500 italic">Non renseigné</span>
                      )}
                    </span>
                  </p>

                  <div className="pt-2 mt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px]">
                    <span className="text-slate-400">Documents :</span>
                    {(clientMode === 'existing' ? currentClient?.licenseDocUrl : newClientForm.licenseDocUrl) ? (
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                        ✓ Permis joint
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[10px] font-mono">
                        Permis non joint
                      </span>
                    )}
                    {(clientMode === 'existing' ? currentClient?.cinDocUrl : newClientForm.cinDocUrl) ? (
                      <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                        ✓ CIN/Passeport joint
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[10px] font-mono">
                        CIN non jointe
                      </span>
                    )}
                  </div>

                  {hasSecondDriver ? (
                    <div className="pt-2 mt-2 border-t border-slate-800 text-[11px]">
                      <span className="text-amber-400 font-bold block mb-0.5">
                        + 2ème Conducteur Agréé :
                      </span>
                      {secondDriverSource === 'driver' && (
                        <p className="text-slate-200">
                          {drivers.find((d) => d.id === selectedSecondDriverId)?.lastName}{' '}
                          {drivers.find((d) => d.id === selectedSecondDriverId)?.firstName} (
                          {drivers.find((d) => d.id === selectedSecondDriverId)?.docNumber} - Permis :{' '}
                          {drivers.find((d) => d.id === selectedSecondDriverId)?.drivingLicense})
                        </p>
                      )}
                      {secondDriverSource === 'client' && (
                        <p className="text-slate-200">
                          {clients.find((c) => c.id === selectedSecondDriverId)?.lastName}{' '}
                          {clients.find((c) => c.id === selectedSecondDriverId)?.firstName} (
                          {clients.find((c) => c.id === selectedSecondDriverId)?.docNumber})
                        </p>
                      )}
                      {secondDriverSource === 'new' && (
                        <p className="text-slate-200">
                          {newSecondDriverForm.lastName} {newSecondDriverForm.firstName} (
                          {newSecondDriverForm.docNumber} - Permis : {newSecondDriverForm.drivingLicense})
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-slate-500 italic pt-1">
                      2ème Conducteur : Aucun (Conducteur unique)
                    </p>
                  )}
                </div>
              </div>

              {/* VÉHICULE SUMMARY */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  2. Véhicule Attribué
                </h3>
                <div className="space-y-1 text-slate-300">
                  <p>
                    Marque & Modèle :{' '}
                    <strong className="text-white uppercase">
                      {currentVehicle?.brand} {currentVehicle?.model}
                    </strong>
                  </p>
                  <p>
                    Immatriculation :{' '}
                    <span className="font-mono font-bold text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                      {currentVehicle?.plate}
                    </span>
                  </p>
                  <p>
                    Motorisation : <span className="text-white">{currentVehicle?.fuelType}</span>
                  </p>
                  <p>
                    KM Départ : <strong className="font-mono text-white">{departureKm.toLocaleString()} KM</strong>
                  </p>
                  <p>
                    Carburant Départ : <strong className="font-mono text-amber-400">{departureFuel}</strong>
                  </p>
                </div>
              </div>

              {/* LOCATION DURATION SUMMARY */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  3. Période & Tarification
                </h3>
                <div className="space-y-1 text-slate-300">
                  <p>
                    Départ :{' '}
                    <strong className="text-white">
                      {new Date(startDate).toLocaleDateString('fr-FR')} à {startTime}
                    </strong>
                  </p>
                  <p>
                    Retour :{' '}
                    <strong className="text-white">
                      {new Date(endDate).toLocaleDateString('fr-FR')} à {endTime}
                    </strong>
                  </p>
                  <p>
                    Durée : <strong className="text-amber-400 font-mono">{totalDays} jour(s)</strong>
                  </p>
                  <p>
                    Total : <strong className="text-amber-400 font-mono">{totalAmount.toLocaleString()} MAD</strong> • Caution :{' '}
                    <strong className="font-mono text-white">{depositAmount.toLocaleString()} MAD</strong>
                  </p>
                </div>
              </div>

              {/* MANAGER & CONTACT SUMMARY */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                  <span>4. Manager & Tél. PDF</span>
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                </h3>
                <div className="space-y-1 text-slate-300">
                  <p>
                    Responsable :{' '}
                    <strong className="text-white">
                      {users.find((u) => u.id === assignedManagerId)?.name || 'Direction Agence'}
                    </strong>
                  </p>
                  <div>
                    <span className="text-slate-400 block text-[11px]">GSM Contrat Imprimé :</span>
                    <span className="font-mono text-amber-400 font-bold block mt-0.5 text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      {managerPhone || users.find((u) => u.id === assignedManagerId)?.phone || companySettings.phone1}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic pt-1">
                    Numéro direct d'assistance affiché sur l'en-tête de la page 1.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p>
                En validant ce contrat, les données seront archivées, le numéro de contrat sera attribué et le document A4 officiel (2 pages Recto/Verso) sera prêt pour impression immédiate avec le cachet officiel Morvello Cars.
              </p>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION CONTROLS */}
        <div className="border-t border-slate-800 pt-4 mt-6 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
            ) : (
              <button
                onClick={() => {
                  if (isEditMode) clearEditingData();
                  setActiveTab(isEditMode ? 'contracts' : 'dashboard');
                }}
                className="text-xs text-slate-500 hover:text-slate-300 font-medium px-2 py-1 cursor-pointer"
              >
                {isEditMode ? 'Annuler la modification' : 'Annuler'}
              </button>
            )}
          </div>

          <div>
            {currentStep < 4 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                disabled={
                  (currentStep === 1 && !isStep1Valid()) ||
                  (currentStep === 2 && !isStep2Valid()) ||
                  (currentStep === 3 && !isStep3Valid())
                }
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                Étape Suivante
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinalSubmit}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-extrabold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-transform active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isEditMode ? 'Enregistrer les modifications' : 'Générer le contrat 2 pages A4'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
