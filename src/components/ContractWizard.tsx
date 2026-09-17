import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Contract, Client, DocumentType, DriverSnapshot, ContractTemplateId } from '../types';
import { formatPlateFrench } from '../utils/plateUtils';
import {
  User,
  Car,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { WizardSuccessView } from './wizard/WizardSuccessView';
import {
  WizardStep1Client,
  NewClientFormData,
  NewSecondDriverFormData,
} from './wizard/WizardStep1Client';
import { WizardStep2Vehicle } from './wizard/WizardStep2Vehicle';
import { WizardStep3Terms } from './wizard/WizardStep3Terms';
import { WizardStep4Review } from './wizard/WizardStep4Review';

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
      return v.assignedManagerId === currentUser?.id;
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
  const [newClientForm, setNewClientForm] = useState<NewClientFormData>({
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
  const [newSecondDriverForm, setNewSecondDriverForm] = useState<NewSecondDriverFormData>({
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
  const [contractNotes] = useState<string>('');

  // Prolongation
  const [hasProlongation, setHasProlongation] = useState<boolean>(false);
  const [prolongationDate, setProlongationDate] = useState<string>('2026-09-12');
  const [prolongationTime, setProlongationTime] = useState<string>('18:00');

  // Step 3 (bis): Manager en charge & Téléphone direct (En-tête PDF)
  const [assignedManagerId, setAssignedManagerId] = useState<string>('');
  const [managerPhone, setManagerPhone] = useState<string>('');

  // Modèle de contrat assigné au créateur ou défini par défaut de l'entreprise
  const userAssignedTemplate: ContractTemplateId =
    currentUser?.assignedContractTemplate || companySettings.defaultContractTemplate || 'standard';
  const [selectedTemplateId, setSelectedTemplateId] = useState<ContractTemplateId>(
    editingContractData?.templateId || userAssignedTemplate
  );

  // Handle edit mode pre-population
  useEffect(() => {
    if (editingContractData) {
      if (editingContractData.templateId) {
        setSelectedTemplateId(editingContractData.templateId);
      }
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
  }, [editingContractData, users]);

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
        const targetMgrId = veh.assignedManagerId || (currentUser?.role === 'manager' ? currentUser.id : '');
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
  }, [selectedVehicleId, vehicles, editingContractData, currentUser, users, companySettings.phone1, assignedManagerId]);

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
      primaryValid =
        newClientForm.firstName.trim() !== '' &&
        newClientForm.lastName.trim() !== '' &&
        newClientForm.docNumber.trim() !== '' &&
        newClientForm.drivingLicense.trim() !== '';
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
      const resolvedMgrId =
        assignedManagerId ||
        currentVehicle?.assignedManagerId ||
        (currentUser?.role === 'manager' ? currentUser.id : undefined);
      const resolvedMgrName =
        users.find((u) => u.id === resolvedMgrId)?.name ||
        currentVehicle?.assignedManagerName ||
        (currentUser?.role === 'manager' ? currentUser.name : undefined);

      finalClient = addClient({
        ...newClientForm,
        assignedManagerId: resolvedMgrId,
        assignedManagerName: resolvedMgrName,
        createdBy: currentUser?.name || currentUser?.id,
      });
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
    const resolvedManagerObj =
      users.find((u) => u.id === assignedManagerId) ||
      (currentVehicle?.assignedManagerId
        ? users.find((u) => u.id === currentVehicle.assignedManagerId)
        : undefined);
    const resolvedManagerPhone =
      managerPhone.trim() || resolvedManagerObj?.phone || companySettings.phone1;

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
          templateId: selectedTemplateId,
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
      templateId: selectedTemplateId,
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
      <WizardSuccessView
        contract={createdContractResult}
        isEditMode={isEditMode}
        onOpenPdf={openPdfModal}
        onDone={() => {
          clearEditingData();
          setActiveTab('contracts');
        }}
      />
    );
  }

  const steps = [
    { id: 1, label: 'Locataire / Client', icon: <User className="w-4 h-4" /> },
    { id: 2, label: 'Véhicule', icon: <Car className="w-4 h-4" /> },
    { id: 3, label: 'Durée & Tarification', icon: <Calendar className="w-4 h-4" /> },
    { id: 4, label: 'Validation & Contrat A4', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* HEADER & WIZARD PROGRESS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        {isEditMode ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/30 pb-4 mb-4 bg-amber-950/20 p-4 rounded-xl border">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">
                Mode Édition / Modification Contractuelle
              </span>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Modification du Contrat</span>
                <span className="text-amber-400 font-mono font-extrabold">
                  {editingContractData?.contractNumber}
                </span>
              </h1>
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
                {companySettings.contractPrefix}-{companySettings.contractYear}-
                {String(companySettings.nextContractNumber).padStart(4, '0')}
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
        {currentStep === 1 && (
          <WizardStep1Client
            clientMode={clientMode}
            setClientMode={setClientMode}
            clientSearchQuery={clientSearchQuery}
            setClientSearchQuery={setClientSearchQuery}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            filteredClients={filteredClients}
            newClientForm={newClientForm}
            setNewClientForm={setNewClientForm}
            hasSecondDriver={hasSecondDriver}
            setHasSecondDriver={setHasSecondDriver}
            secondDriverSource={secondDriverSource}
            setSecondDriverSource={setSecondDriverSource}
            selectedSecondDriverId={selectedSecondDriverId}
            setSelectedSecondDriverId={setSelectedSecondDriverId}
            secondDriverSearchQuery={secondDriverSearchQuery}
            setSecondDriverSearchQuery={setSecondDriverSearchQuery}
            filteredDrivers={filteredDrivers}
            clients={clients}
            isManager={isManager}
            getClientAssignedManager={getClientAssignedManager}
            currentUserId={currentUser?.id}
            newSecondDriverForm={newSecondDriverForm}
            setNewSecondDriverForm={setNewSecondDriverForm}
          />
        )}

        {currentStep === 2 && (
          <WizardStep2Vehicle
            availableVehiclesForContract={availableVehiclesForContract}
            selectedVehicleId={selectedVehicleId}
            setSelectedVehicleId={setSelectedVehicleId}
            isManager={isManager}
            currentUser={currentUser}
            isEditMode={isEditMode}
            editingContractVehicleId={editingContractData?.vehicleId}
          />
        )}

        {currentStep === 3 && (
          <WizardStep3Terms
            startDate={startDate}
            setStartDate={setStartDate}
            startTime={startTime}
            setStartTime={setStartTime}
            departureKm={departureKm}
            setDepartureKm={setDepartureKm}
            departureFuel={departureFuel}
            setDepartureFuel={setDepartureFuel}
            endDate={endDate}
            setEndDate={setEndDate}
            endTime={endTime}
            setEndTime={setEndTime}
            pricePerDay={pricePerDay}
            setPricePerDay={setPricePerDay}
            depositAmount={depositAmount}
            setDepositAmount={setDepositAmount}
            hasProlongation={hasProlongation}
            setHasProlongation={setHasProlongation}
            prolongationDate={prolongationDate}
            setProlongationDate={setProlongationDate}
            prolongationTime={prolongationTime}
            setProlongationTime={setProlongationTime}
            assignedManagerId={assignedManagerId}
            setAssignedManagerId={setAssignedManagerId}
            managerPhone={managerPhone}
            setManagerPhone={setManagerPhone}
            users={users}
            companySettings={companySettings}
            totalDays={totalDays}
            totalAmount={totalAmount}
          />
        )}

        {currentStep === 4 && (
          <WizardStep4Review
            termsVersion={termsVersion}
            clientMode={clientMode}
            currentClient={currentClient || undefined}
            newClientForm={newClientForm}
            hasSecondDriver={hasSecondDriver}
            secondDriverSource={secondDriverSource}
            selectedSecondDriverId={selectedSecondDriverId}
            drivers={drivers}
            clients={clients}
            newSecondDriverForm={newSecondDriverForm}
            currentVehicle={currentVehicle}
            departureKm={departureKm}
            departureFuel={departureFuel}
            startDate={startDate}
            startTime={startTime}
            endDate={endDate}
            endTime={endTime}
            totalDays={totalDays}
            totalAmount={totalAmount}
            depositAmount={depositAmount}
            assignedManagerId={assignedManagerId}
            managerPhone={managerPhone}
            users={users}
            companySettings={companySettings}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            currentUser={currentUser}
          />
        )}

        {/* BOTTOM NAVIGATION CONTROLS */}
        <div className="border-t border-slate-800 pt-4 mt-6 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
            ) : (
              <button
                type="button"
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
                type="button"
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
                type="button"
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
