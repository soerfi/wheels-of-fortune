import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Settings, Gift, Trophy, Plus, Trash2, Edit2, Save, X, Download, Upload, Eye } from 'lucide-react';
import Papa from 'papaparse';
import AlertModal from '../components/AlertModal';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'prizes' | 'winners'>('settings');
  const [settings, setSettings] = useState<any>(null);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appAlert, setAppAlert] = useState<{ type: 'error' | 'success', message: string, title?: string } | null>(null);

  // Form states
  const [editingPrize, setEditingPrize] = useState<any>(null);
  const [newPrize, setNewPrize] = useState({ name: '', color: '#EF4444', description: '', quantity: 10, prefix: '', custom_codes: '' });
  const [generateCodesState, setGenerateCodesState] = useState<{ id: number, add_quantity: number, prefix: string } | null>(null);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.token);
        setIsAuthenticated(true);
      } else {
        setAppAlert({ type: 'error', message: 'Falsches Passwort oder Rate-Limit erreicht!' });
      }
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Login fehlgeschlagen.' });
    }
  };

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${authToken}` };
      const [sRes, pRes, wRes] = await Promise.all([
        fetch('/api/settings', { headers }),
        fetch('/api/prizes', { headers }),
        fetch('/api/winners', { headers })
      ]);
      setSettings(await sRes.json());
      setPrizes(await pRes.json());
      setWinners(await wRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(settings)
      });
      setAppAlert({ type: 'success', message: 'Einstellungen gespeichert!' });
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Speichern.' });
    }
  };

  const handleAddPrize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newPrize };
      const customCodesArray = newPrize.custom_codes.split('\n').map(c => c.trim()).filter(Boolean);

      if (customCodesArray.length === 0) {
        setAppAlert({ type: 'error', message: 'Du musst mindestens einen Code eingeben, um einen Preis zu erstellen.' });
        return;
      }

      const reqRes = await fetch('/api/prizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ ...payload, custom_codes: customCodesArray })
      });

      if (!reqRes.ok) {
        let errDesc = reqRes.statusText;
        try { const err = await reqRes.json(); errDesc = err.error || errDesc; } catch (e) { }
        setAppAlert({ type: 'error', message: `Fehler beim Speichern: ${errDesc}` });
        return;
      }

      setNewPrize({ name: '', description: '', value: '', weight: 1, quantity: 10, prefix: '', custom_codes: '' });
      fetchData();
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Hinzufügen.' });
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Expect columns: Name, Beschreibung, Wert, Gewichtung, Code
          const prizesMap: Record<string, any> = {};

          results.data.forEach((row: any) => {
            if (!row.Name) return;
            const name = row.Name.trim();
            if (!prizesMap[name]) {
              prizesMap[name] = {
                name,
                description: row.Beschreibung || '',
                value: row.Wert || '',
                weight: parseInt(row.Gewichtung) || 1,
                codes: []
              };
            }
            if (row.Code && row.Code.trim() !== '') {
              prizesMap[name].codes.push(row.Code.trim());
            }
          });

          const prizesPayload = Object.values(prizesMap);

          const res = await fetch('/api/admin/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ prizes: prizesPayload })
          });

          if (res.ok) {
            setAppAlert({ type: 'success', message: 'CSV Import erfolgreich!' });
            fetchData();
          } else {
            setAppAlert({ type: 'error', message: 'Fehler beim CSV Import.' });
          }
        } catch (err) {
          setAppAlert({ type: 'error', message: 'Fehler beim Verarbeiten der CSV Datei.' });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const generateSampleCSV = () => {
    const csvContent = '\uFEFFName;Beschreibung;Wert;Gewichtung;Code\nTest Preis;Du hast etwas Tolles gewonnen!;CHF 50.-;1;TEST-123\nAnderer Preis;Ein weiterer Gewinn;15% Rabatt;10;TEST-456';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'skate-ch-preise-muster.csv';
    link.click();
  };

  const handleUpdatePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`/api/prizes/${editingPrize.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(editingPrize)
      });
      setEditingPrize(null);
      fetchData();
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Aktualisieren.' });
    }
  };

  const [prizeToDelete, setPrizeToDelete] = useState<number | null>(null);

  const handleDeletePrize = async () => {
    if (!prizeToDelete) return;
    try {
      await fetch(`/api/prizes/${prizeToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      setPrizeToDelete(null);
      fetchData();
    } catch (err) {
      setAppAlert({ type: 'error', message: 'Fehler beim Löschen.' });
    }
  };

  // Auto-generation is removed so we just delete the redundant API routes
  const [viewingCodesFor, setViewingCodesFor] = useState<any>(null);

  const addTimeSlot = () => {
    const newSlots = [...(settings.active_slots || []), { from: new Date().toISOString(), to: new Date(Date.now() + 86400000).toISOString() }];
    setSettings({ ...settings, active_slots: newSlots });
  };

  const removeTimeSlot = (index: number) => {
    const newSlots = settings.active_slots.filter((_: any, i: number) => i !== index);
    setSettings({ ...settings, active_slots: newSlots });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-black uppercase tracking-widest text-white mb-8">
          SKATE.CH <span className="text-red-500">Admin</span>
        </h1>
        <form onSubmit={handleLogin} className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-sm w-full">
          <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Passwort eingeben</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors mb-6"
            autoFocus
          />
          <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg uppercase tracking-widest transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Laden...</div>;

  const formatDatetimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12 border-b border-zinc-800 pb-6">
          <h1 className="text-4xl font-black uppercase tracking-widest text-white">
            SKATE.CH <span className="text-red-500">Admin</span>
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors ${activeTab === 'settings' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Settings size={20} /> Einstellungen
            </button>
            <button
              onClick={() => setActiveTab('prizes')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors ${activeTab === 'prizes' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Gift size={20} /> Preise
            </button>
            <button
              onClick={() => setActiveTab('winners')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-colors ${activeTab === 'winners' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Trophy size={20} /> Gewinner
            </button>
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && settings && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6 uppercase tracking-widest border-b border-zinc-800 pb-4">Allgemeine Einstellungen</h2>
              <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider">Geplante Aktivitäts-Slots</label>
                    <button type="button" onClick={addTimeSlot} className="flex items-center gap-2 text-red-500 hover:text-red-400 font-bold uppercase text-sm">
                      <Plus size={16} /> Slot Hinzufügen
                    </button>
                  </div>

                  {settings.active_slots?.map((slot: any, index: number) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end bg-zinc-950 p-4 border border-zinc-800 rounded-lg">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Start</label>
                        <input
                          type="datetime-local"
                          value={formatDatetimeLocal(slot.from)}
                          onChange={e => {
                            if (!e.target.value) return;
                            const newSlots = [...settings.active_slots];
                            newSlots[index].from = new Date(e.target.value).toISOString();
                            setSettings({ ...settings, active_slots: newSlots });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Ende</label>
                        <input
                          type="datetime-local"
                          value={formatDatetimeLocal(slot.to)}
                          onChange={e => {
                            if (!e.target.value) return;
                            const newSlots = [...settings.active_slots];
                            newSlots[index].to = new Date(e.target.value).toISOString();
                            setSettings({ ...settings, active_slots: newSlots });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <button type="button" onClick={() => removeTimeSlot(index)} className="p-2 text-zinc-500 hover:text-red-500 mb-1">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  {(!settings.active_slots || settings.active_slots.length === 0) && (
                    <p className="text-sm text-zinc-500 italic">Keine Slots konfiguriert. Das Rad bleibt inaktiv.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Gutschein Hintergrundbild URL</label>
                  <input
                    type="url"
                    value={settings.voucher_bg_url}
                    onChange={e => setSettings({ ...settings, voucher_bg_url: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="https://..."
                  />
                  {settings.voucher_bg_url && (
                    <div className="mt-4 h-40 rounded-lg overflow-hidden border border-zinc-800 relative">
                      <img src={settings.voucher_bg_url} alt="Voucher Background" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold tracking-widest uppercase">Vorschau</span>
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-lg font-bold uppercase tracking-widest transition-colors">
                  <Save size={20} /> Speichern
                </button>
              </form>
            </div>
          )}

          {/* PRIZES TAB */}
          {activeTab === 'prizes' && (
            <div className="space-y-8">
              {/* Add Prize Form */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                <h2 className="text-2xl font-bold mb-6 uppercase tracking-widest border-b border-zinc-800 pb-4">Neuen Preis hinzufügen</h2>
                <form onSubmit={handleAddPrize} className="flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-[2]">
                      <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Name des Preises</label>
                      <input type="text" required value={newPrize.name} onChange={e => setNewPrize({ ...newPrize, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="z.B. SKATE.CH Gutschein" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Wert</label>
                      <input type="text" value={newPrize.value} onChange={e => setNewPrize({ ...newPrize, value: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="z.B. CHF 50.-" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Gewichtung</label>
                      <input type="number" min="1" value={newPrize.weight || 1} onChange={e => setNewPrize({ ...newPrize, weight: parseInt(e.target.value) || 1 })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="z.B. 10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Beschreibung (für Win-Popup / E-Mail)</label>
                    <textarea value={newPrize.description} onChange={e => setNewPrize({ ...newPrize, description: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500" placeholder="Du erhältst 50 CHF Rabatt auf deinen nächsten Einkauf..." rows={2} />
                  </div>

                  {/* CODES OPTIONS */}
                  <div className="bg-zinc-950/50 p-6 rounded-lg border border-zinc-800">
                    <h3 className="font-bold text-red-500 mb-4 uppercase tracking-wider text-sm border-b border-red-900/30 pb-2">Preis Codes</h3>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">1 Code pro Zeile</label>
                    <textarea value={newPrize.custom_codes} onChange={e => setNewPrize({ ...newPrize, custom_codes: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2 text-white focus:outline-none focus:border-red-500 text-xs font-mono" placeholder="GUTSCHEIN-A11&#10;GUTSCHEIN-B22" rows={5} />
                  </div>

                  <button type="submit" className="w-full md:w-auto self-end flex items-center justify-center h-[50px] px-8 bg-white text-black hover:bg-zinc-200 rounded-lg font-bold uppercase tracking-widest transition-colors">
                    <Plus size={20} className="mr-2" /> Preis anlegen
                  </button>
                </form>
              </div>

              {/* CSV Import */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 border-l-4 border-l-red-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-4 border-b border-zinc-800">
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">Alternativ: Preis & Code CSV-Import</h2>
                    <p className="text-zinc-500 text-sm">Spalten: <code className="text-red-400">Name, Beschreibung, Wert, Gewichtung, Code</code></p>
                  </div>
                  <button type="button" onClick={generateSampleCSV} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-bold text-sm uppercase tracking-wider">
                    <Download size={16} /> Muster herunterladen
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImportCSV}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-700 hover:border-red-500 rounded-lg text-zinc-400 hover:text-white transition-colors uppercase font-bold tracking-wider"
                  >
                    <Upload size={20} /> CSV Datei auswählen & importieren
                  </button>
                </div>
              </div>

              {/* Prizes List */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mt-8">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Wert / Gew.</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Menge</th>
                      <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {prizes.map((prize, idx) => (
                      <tr key={prize.id} className="hover:bg-zinc-800/50 transition-colors">
                        {editingPrize?.id === prize.id ? (
                          <td colSpan={4} className="p-4">
                            <form onSubmit={handleUpdatePrize} className="flex flex-col gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-700">
                              <div className="flex gap-4">
                                <input type="text" value={editingPrize.name} onChange={e => setEditingPrize({ ...editingPrize, name: e.target.value })} className="flex-[2] bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white" placeholder="Preis Name..." />
                                <input type="text" value={editingPrize.value || ''} onChange={e => setEditingPrize({ ...editingPrize, value: e.target.value })} className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white" placeholder="Wert..." title="Wert" />
                                <input type="number" min="1" value={editingPrize.weight || 1} onChange={e => setEditingPrize({ ...editingPrize, weight: parseInt(e.target.value) || 1 })} className="w-20 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white" placeholder="Gew." title="Gewichtung" />
                              </div>
                              <textarea value={editingPrize.description || ''} onChange={e => setEditingPrize({ ...editingPrize, description: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm" placeholder="Beschreibung (für E-Mail und WIN-Popup)" rows={2} />
                              <div className="flex justify-end gap-2">
                                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white flex items-center gap-2 text-sm"><Save size={16} /> Speichern</button>
                                <button type="button" onClick={() => setEditingPrize(null)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-white text-sm flex items-center gap-2"><X size={16} /> Abbrechen</button>
                              </div>
                            </form>
                          </td>
                        ) : (
                          <>
                            <td className="px-6 py-4">
                              <div className="font-bold text-white text-lg">{prize.name}</div>
                              {prize.description && <div className="text-sm text-zinc-500 mt-1">{prize.description}</div>}
                            </td>
                            <td className="px-6 py-4 w-40">
                              <div className="text-white bg-zinc-800 px-3 py-1 rounded inline-block text-sm mb-1">{prize.value || '-'}</div>
                              <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Gewichtung: <strong className="text-white font-bold">{prize.weight || 1}</strong></div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-zinc-500 mr-2 text-xs">Total: {prize.initial_quantity}</span>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${prize.remaining_quantity > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                Verf: {prize.remaining_quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button title="Codes Anzeigen" onClick={() => setViewingCodesFor(prize)} className="p-2 text-zinc-400 hover:text-green-500 transition-colors mr-2"><Eye size={18} /></button>
                              <button title="Preis umbenennen" onClick={() => setEditingPrize(prize)} className="p-2 text-zinc-400 hover:text-white transition-colors"><Edit2 size={18} /></button>
                              <button title="Preis löschen" onClick={() => setPrizeToDelete(prize.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors ml-2"><Trash2 size={18} /></button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {prizes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Keine Preise vorhanden.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
          }

          {/* WINNERS TAB */}
          {
            activeTab === 'winners' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const csvContent = [
                        ['Datum', 'Preis', 'Code', 'Name', 'E-Mail'],
                        ...winners.map(w => [
                          new Date(w.won_at).toLocaleString('de-CH'),
                          w.prize_name || 'Unbekannt',
                          w.code,
                          w.user_name || '',
                          w.user_email || ''
                        ])
                      ].map(e => e.join(',')).join('\n');

                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = 'skate-ch-gewinner.csv';
                      link.click();
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold uppercase tracking-wider transition-colors"
                  >
                    <Download size={20} /> CSV Export
                  </button>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-950 border-b border-zinc-800">
                      <tr>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Datum</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Preis</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Code</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-sm font-bold text-zinc-400 uppercase tracking-wider">E-Mail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {winners.map(winner => (
                        <tr key={winner.id} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4 text-zinc-400">
                            {new Date(winner.won_at).toLocaleString('de-CH')}
                          </td>
                          <td className="px-6 py-4 font-bold">{winner.prize_name || 'Unbekannt'}</td>
                          <td className="px-6 py-4 font-mono text-red-400">{winner.code}</td>
                          <td className="px-6 py-4">{winner.user_name || '-'}</td>
                          <td className="px-6 py-4 text-zinc-400">{winner.user_email || '-'}</td>
                        </tr>
                      ))}
                      {winners.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Noch keine Gewinner.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          }
        </motion.div>
      </div >

      {/* DELETE CONFIRMATION MODAL */}
      {
        prizeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-950 border-4 border-white shadow-[16px_16px_0_0_#EF4444] p-8" role="dialog" aria-modal="true">
              <h3 className="text-4xl font-display uppercase tracking-widest text-white mb-4">Löschen?</h3>
              <p className="text-zinc-400 font-bold uppercase tracking-wider mb-8">
                Möchtest du diesen Preis wirklich endgültig löschen? Alle dazugehörigen Codes werden ebenfalls entfernt.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setPrizeToDelete(null)}
                  className="flex-1 py-4 border-2 border-zinc-700 hover:border-white text-zinc-400 hover:text-white font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeletePrize}
                  className="flex-1 py-4 bg-red-600 hover:bg-white border-2 border-transparent hover:border-black text-white hover:text-black font-bold uppercase tracking-widest transition-all hover:-translate-y-1 hover:shadow-[-4px_4px_0_0_#000] cursor-pointer"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* CODES VIEW MODAL */}
      {
        viewingCodesFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-700 flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-widest text-white">Codes für '{viewingCodesFor.name}'</h3>
                  <p className="text-sm text-zinc-500 mt-1">Total: {viewingCodesFor.codes_list?.length || 0} Codes</p>
                </div>
                <button onClick={() => setViewingCodesFor(null)} className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-800 hover:bg-zinc-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto bg-zinc-950 font-mono text-sm leading-relaxed text-zinc-300">
                {viewingCodesFor.codes_list?.length > 0 ? (
                  <ul className="space-y-2">
                    {viewingCodesFor.codes_list.map((c: any, i: number) => (
                      <li key={i} className="flex justify-between items-center border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                        <span className={`${c.is_used ? 'text-zinc-600 line-through' : 'text-green-500 font-bold'}`}>{c.code}</span>
                        <span className={`text-xs px-2 py-1 uppercase tracking-wider font-bold rounded ${c.is_used ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-green-500/10 text-green-500 border border-green-500/30'}`}>
                          {c.is_used ? 'Eingelöst' : 'Offen'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center text-zinc-500 py-8 uppercase tracking-widest text-xs font-bold">Keine Codes vorhanden.</div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* GLOBAL ALERTS */}
      {appAlert && (
        <AlertModal
          type={appAlert.type}
          title={appAlert.title}
          message={appAlert.message}
          onClose={() => setAppAlert(null)}
        />
      )}

    </div >
  );
}
