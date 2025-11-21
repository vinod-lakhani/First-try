/**
 * Profile & Settings Page
 * 
 * Comprehensive configuration and transparency hub for user settings.
 */

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/lib/onboarding/store';
import { buildProfileData } from '@/lib/profile/buildProfileData';
import type { ProfilePageData } from '@/lib/profile/types';
import { getMostRecentConsent } from '@/lib/legal/getLatestConsent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CheckCircle2, Clock, AlertCircle, Pencil, X, Check, Shield, Mail, Lock, Link2, Download, Trash2, FileText } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const state = useOnboardingStore();
  
  // Build profile data from store
  const profileData = useMemo<ProfilePageData>(() => {
    return buildProfileData(state, 'user@example.com'); // TODO: Get actual user email
  }, [state]);

  // Get consent information
  const userId = 'current-user-id'; // TODO: Get from auth context
  const latestConsent = useMemo(() => {
    if (typeof window !== 'undefined') {
      return getMostRecentConsent(userId);
    }
    return null;
  }, [userId]);

  // Edit states for each section
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [localData, setLocalData] = useState<ProfilePageData>(profileData);

  // Update local data when profile data changes
  useEffect(() => {
    setLocalData(profileData);
  }, [profileData]);

  const handleSave = (section: string, updates: Partial<ProfilePageData>) => {
    setLocalData({ ...localData, ...updates });
    setEditingSection(null);
    // TODO: Save to store/API
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-lg space-y-6">
          {/* 1. Onboarding Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Profile & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Onboarding Status:</span>
                  {localData.onboarding.status === 'complete' ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Complete</span>
                    </div>
                  ) : localData.onboarding.status === 'in_progress' ? (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      <span>In progress</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>Not started</span>
                    </div>
                  )}
                </div>
                {localData.onboarding.completedAt && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Completed on {new Date(localData.onboarding.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Update your answers anytime to refresh your plan.
              </p>

              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/onboarding')}
                >
                  Re-run onboarding
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/app/home')}
                >
                  View your plan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2. Personal & Life Stage */}
          <ProfileSection
            title="Personal & Life Stage"
            description="Context for time horizon, assumptions, and suggested goals."
            summary={`${localData.personal.ageRange}, ${localData.personal.employmentType.replace('_', ' ')}, ${localData.personal.householdStatus}, ${localData.personal.location}`}
            note="We use this to tailor timelines, risk assumptions, and recommended goals."
            isEditing={editingSection === 'personal'}
            onEdit={() => setEditingSection('personal')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('personal', { personal: { ...localData.personal, ...updates } })}
          >
            <PersonalLifeStageEditor
              data={localData.personal}
              onUpdate={(updates) => handleSave('personal', { personal: { ...localData.personal, ...updates } })}
            />
          </ProfileSection>

          {/* 3. Income & Housing */}
          <ProfileSection
            title="Income & Housing"
            description="Define the key recurring cash flow assumptions."
            summary={`Take-home: ${formatCurrency(localData.incomeHousing.monthlyNetIncome$)}, Rent: ${formatCurrency(localData.incomeHousing.rentOrHousing$)}, Other fixed needs: ${formatCurrency(localData.incomeHousing.otherFixedNeeds$)}`}
            note="These numbers power your Needs/Wants/Savings plan and rent impact simulations."
            isEditing={editingSection === 'income'}
            onEdit={() => setEditingSection('income')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('income', { incomeHousing: { ...localData.incomeHousing, ...updates } })}
          >
            <IncomeHousingEditor
              data={localData.incomeHousing}
              onUpdate={(updates) => {
                // Update store
                if (updates.monthlyNetIncome$) {
                  const paychecksPerMonth = state.income ? 
                    (state.income.payFrequency === 'weekly' ? 4.33 :
                     state.income.payFrequency === 'biweekly' ? 2.17 :
                     state.income.payFrequency === 'semimonthly' ? 2 : 1) : 1;
                  const perPaycheck = updates.monthlyNetIncome$ / paychecksPerMonth;
                  state.updateIncome({ netIncome$: perPaycheck });
                }
                handleSave('income', { incomeHousing: { ...localData.incomeHousing, ...updates } });
              }}
            />
          </ProfileSection>

          {/* 4. Financial Connections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Connections</CardTitle>
              <CardDescription>
                Manage connected accounts and data freshness
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {localData.connections.length > 0 ? (
                <div className="space-y-3">
                  {localData.connections.map((conn, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{conn.institutionName}</div>
                        {conn.lastSyncAt && (
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 ${
                        conn.status === 'connected' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {conn.status === 'connected' ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">Connected</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">Reconnect needed</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No connected accounts
                </p>
              )}

              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/onboarding/plaid-consent')}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect another account
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    // Refresh data
                    state.setLastSyncDate(new Date().toISOString());
                  }}
                >
                  Refresh data
                </Button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                We use these connections to track your spending, savings, and net worth automatically.
              </p>
            </CardContent>
          </Card>

          {/* 5. Goals & Priorities */}
          <ProfileSection
            title="Goals & Priorities"
            description="Tell the engine what outcomes to prioritize when allocating savings."
            summary={(() => {
              const goals = [];
              if (localData.goals.emergencyFundEnabled) goals.push(`EF: ${localData.goals.emergencyFundMonths}mo`);
              if (localData.goals.highInterestDebtEnabled) goals.push('Debt payoff');
              if (localData.goals.retirementEnabled) goals.push('Retirement');
              if (localData.goals.bigPurchaseEnabled) goals.push('Big purchase');
              return goals.join(' · ') || 'No goals set';
            })()}
            note="Your goals guide how we prioritize emergency savings, debt payoff, retirement, and investing in your plan."
            isEditing={editingSection === 'goals'}
            onEdit={() => setEditingSection('goals')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('goals', { goals: { ...localData.goals, ...updates } })}
          >
            <GoalsEditor
              data={localData.goals}
              state={state}
              onUpdate={(updates) => {
                // Update store
                if (updates.emergencyFundMonths !== undefined) {
                  state.updateSafetyStrategy({ efTargetMonths: updates.emergencyFundMonths });
                }
                if (updates.debtStrategy) {
                  state.updateSafetyStrategy({ debtPayoffStrategy: updates.debtStrategy });
                }
                if (updates.retirementFocus) {
                  state.updateSafetyStrategy({ retirementFocus: updates.retirementFocus.charAt(0).toUpperCase() + updates.retirementFocus.slice(1) as any });
                }
                if (updates.liquidityNeed) {
                  state.updateSafetyStrategy({ liquidity: updates.liquidityNeed.charAt(0).toUpperCase() + updates.liquidityNeed.slice(1) as any });
                }
                handleSave('goals', { goals: { ...localData.goals, ...updates } });
              }}
            />
          </ProfileSection>

          {/* 6. Plan Settings */}
          <ProfileSection
            title="Plan Settings (Engine Knobs)"
            description="Tune how aggressive the system is with changes."
            summary={`Savings target: ${formatPercent(localData.plan.savingsTargetPct)}, Change aggressiveness: ${localData.plan.changeAggressiveness}, Min wants: ${formatPercent(localData.plan.wantsFloorPct)}`}
            note="We'll never exceed your comfort settings when adjusting your plan month-to-month."
            isEditing={editingSection === 'plan'}
            onEdit={() => setEditingSection('plan')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('plan', { plan: { ...localData.plan, ...updates } })}
          >
            <PlanSettingsEditor
              data={localData.plan}
              state={state}
              onUpdate={(updates) => {
                // Update store
                if (updates.savingsTargetPct !== undefined) {
                  const currentTargets = state.riskConstraints?.targets || { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
                  state.updateRiskConstraints({
                    targets: { ...currentTargets, savingsPct: updates.savingsTargetPct }
                  });
                }
                if (updates.changeAggressiveness) {
                  const shiftLimit = updates.changeAggressiveness === 'gentle' ? 0.02 :
                                   updates.changeAggressiveness === 'balanced' ? 0.04 : 0.06;
                  state.updateRiskConstraints({ shiftLimitPct: shiftLimit });
                }
                if (updates.wantsFloorPct !== undefined) {
                  const currentTargets = state.riskConstraints?.targets || { needsPct: 0.5, wantsPct: 0.3, savingsPct: 0.2 };
                  state.updateRiskConstraints({
                    targets: { ...currentTargets, wantsPct: updates.wantsFloorPct }
                  });
                }
                handleSave('plan', { plan: { ...localData.plan, ...updates } });
              }}
            />
          </ProfileSection>

          {/* 7. Notifications & Nudges */}
          <ProfileSection
            title="Notifications & Nudges"
            description="Control how, what, and how often WeLeap reaches out."
            summary={`${localData.notifications.channels.email ? 'Email' : ''} ${localData.notifications.channels.sms ? 'SMS' : ''} ${localData.notifications.channels.push ? 'Push' : ''} · ${localData.notifications.frequency.replace('_', ' ')}`}
            note="We'll respect your notification preferences while still making sure you don't miss critical updates."
            isEditing={editingSection === 'notifications'}
            onEdit={() => setEditingSection('notifications')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('notifications', { notifications: { ...localData.notifications, ...updates } })}
          >
            <NotificationsEditor
              data={localData.notifications}
              state={state}
              onUpdate={(updates) => {
                // Update store
                if (updates.frequency) {
                  const frequencyMap: Record<"important_only" | "weekly" | "frequent", "monthly" | "weekly" | "daily"> = { 
                    important_only: 'monthly', 
                    weekly: 'weekly', 
                    frequent: 'daily' 
                  };
                  const channels = updates.channels || localData.notifications.channels;
                  state.updatePulsePreferences({
                    enabled: true,
                    frequency: frequencyMap[updates.frequency as keyof typeof frequencyMap],
                    channels: Object.entries(channels).filter(([_, enabled]) => enabled).map(([key, _]) => key as any),
                  });
                }
                handleSave('notifications', { notifications: { ...localData.notifications, ...updates } });
              }}
            />
          </ProfileSection>

          {/* 8. Investment & Risk Preferences */}
          <ProfileSection
            title="Investment & Risk Preferences"
            description="Capture user comfort with market risk and time horizon."
            summary={`Risk: ${localData.risk.riskComfort}, Horizon: ${localData.risk.mainHorizon}, Crypto: ${localData.risk.cryptoStance || 'avoid'}`}
            note="We use this to align investment recommendations and projections with your comfort level and timeline."
            isEditing={editingSection === 'risk'}
            onEdit={() => setEditingSection('risk')}
            onCancel={() => setEditingSection(null)}
            onSave={(updates) => handleSave('risk', { risk: { ...localData.risk, ...updates } })}
          >
            <RiskPreferencesEditor
              data={localData.risk}
              state={state}
              onUpdate={(updates) => {
                // Update store
                if (updates.riskComfort) {
                  const riskScore = updates.riskComfort === 'conservative' ? 2 : updates.riskComfort === 'balanced' ? 3 : 4;
                  state.updateRiskConstraints({ riskScore1to5: riskScore });
                }
                if (updates.mainHorizon) {
                  state.updateRiskConstraints({ dominantTimeHorizon: updates.mainHorizon });
                }
                handleSave('risk', { risk: { ...localData.risk, ...updates } });
              }}
            />
          </ProfileSection>

          {/* 9. Security & Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Security & Data</CardTitle>
              <CardDescription>
                Build trust and give users control over data and account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Login & Security</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Email:</span>
                      <span className="font-medium">{localData.security.email}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full">
                      Change password
                    </Button>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">2FA:</span>
                      <span className={localData.security.twoFAEnabled ? 'text-green-600' : 'text-slate-400'}>
                        {localData.security.twoFAEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    {!localData.security.twoFAEnabled && (
                      <Button variant="outline" size="sm" className="w-full">
                        Set up 2FA
                      </Button>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Data & Privacy</h3>
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Download className="mr-2 h-4 w-4" />
                      Download my data
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete my data / Close my account
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Your data is encrypted and secure. We never share your personal information.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Legal & Consents</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Terms of Service:</span>
                      <Link href="/legal/terms" className="text-sm font-medium text-primary hover:underline">
                        View Terms
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Privacy Policy:</span>
                      <Link href="/legal/privacy" className="text-sm font-medium text-primary hover:underline">
                        View Policy
                      </Link>
                    </div>
                    {latestConsent && (
                      <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-800">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Last accepted on:
                        </p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {new Date(latestConsent.createdAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          ToS v{latestConsent.tosVersion} · Privacy Policy v{latestConsent.ppVersion}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-2 font-medium text-slate-900 dark:text-white">Consents</h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={localData.security.allowAnonymizedUsage}
                      onChange={(e) => handleSave('security', {
                        security: { ...localData.security, allowAnonymizedUsage: e.target.checked }
                      })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Allow anonymized usage data to improve WeLeap
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Reusable Profile Section Component
function ProfileSection({
  title,
  description,
  summary,
  note,
  children,
  isEditing,
  onEdit,
  onCancel,
  onSave,
}: {
  title: string;
  description: string;
  summary: string;
  note?: string;
  children: React.ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: any) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          <>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{summary}</p>
            </div>
            {note && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </>
        ) : (
          <>
            {children}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={() => onSave({})}>
                <Check className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Editor Components (simplified - full implementations below)
function PersonalLifeStageEditor({ data, onUpdate }: { data: any; onUpdate: (updates: any) => void }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Age Range</label>
        <select
          value={formData.ageRange}
          onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="18-21">18-21</option>
          <option value="22-25">22-25</option>
          <option value="26-30">26-30</option>
          <option value="31-35">31-35</option>
          <option value="36-40">36-40</option>
          <option value="41-50">41-50</option>
          <option value="50+">50+</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Employment Type</label>
        <select
          value={formData.employmentType}
          onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="student">Student</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contractor">Contractor</option>
          <option value="self_employed">Self-employed</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Household Status</label>
        <select
          value={formData.householdStatus}
          onChange={(e) => setFormData({ ...formData, householdStatus: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="single">Single</option>
          <option value="couple">Couple</option>
          <option value="family">Couple + Kids</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Location</label>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          className="w-full rounded border px-3 py-2"
          placeholder="City, State"
        />
      </div>
      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}

function IncomeHousingEditor({ data, onUpdate }: { data: any; onUpdate: (updates: any) => void }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Monthly Net Income</label>
        <input
          type="number"
          value={formData.monthlyNetIncome$}
          onChange={(e) => setFormData({ ...formData, monthlyNetIncome$: parseFloat(e.target.value) })}
          className="w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Income Source</label>
        <select
          value={formData.incomeSource}
          onChange={(e) => setFormData({ ...formData, incomeSource: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="salary">Salary</option>
          <option value="hourly">Hourly</option>
          <option value="gig">Gig</option>
          <option value="mixed">Mixed</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Rent or Housing Payment</label>
        <input
          type="number"
          value={formData.rentOrHousing$}
          onChange={(e) => setFormData({ ...formData, rentOrHousing$: parseFloat(e.target.value) })}
          className="w-full rounded border px-3 py-2"
        />
      </div>
      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}

function GoalsEditor({ data, onUpdate, state }: { data: any; onUpdate: (updates: any) => void; state: any }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.emergencyFundEnabled}
            onChange={(e) => setFormData({ ...formData, emergencyFundEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>Build / maintain Emergency Fund</span>
        </label>
        {formData.emergencyFundEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-sm">Target months:</label>
            <select
              value={formData.emergencyFundMonths}
              onChange={(e) => setFormData({ ...formData, emergencyFundMonths: parseInt(e.target.value) as 3 | 6 | 9 })}
              className="w-full rounded border px-3 py-2"
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={9}>9 months</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.highInterestDebtEnabled}
            onChange={(e) => setFormData({ ...formData, highInterestDebtEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>Pay down high-interest debt</span>
        </label>
        {formData.highInterestDebtEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-sm">Strategy:</label>
            <select
              value={formData.debtStrategy}
              onChange={(e) => setFormData({ ...formData, debtStrategy: e.target.value })}
              className="w-full rounded border px-3 py-2"
            >
              <option value="avalanche">Avalanche (mathematically optimal)</option>
              <option value="snowball">Snowball (motivation-first)</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.retirementEnabled}
            onChange={(e) => setFormData({ ...formData, retirementEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>Grow retirement savings</span>
        </label>
        {formData.retirementEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-sm">Focus:</label>
            <select
              value={formData.retirementFocus}
              onChange={(e) => setFormData({ ...formData, retirementFocus: e.target.value })}
              className="w-full rounded border px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.bigPurchaseEnabled}
            onChange={(e) => setFormData({ ...formData, bigPurchaseEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <span>Save for a home down payment / big purchase</span>
        </label>
        {formData.bigPurchaseEnabled && (
          <div className="ml-6">
            <label className="mb-1 block text-sm">Liquidity need:</label>
            <select
              value={formData.liquidityNeed}
              onChange={(e) => setFormData({ ...formData, liquidityNeed: e.target.value })}
              className="w-full rounded border px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        )}
      </div>

      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}

function PlanSettingsEditor({ data, onUpdate, state }: { data: any; onUpdate: (updates: any) => void; state: any }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium">Savings Target</label>
          <span className="text-sm font-semibold">{(formData.savingsTargetPct * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[formData.savingsTargetPct * 100]}
          onValueChange={([value]) => setFormData({ ...formData, savingsTargetPct: value / 100 })}
          min={10}
          max={30}
          step={1}
          className="w-full"
        />
        <p className="mt-1 text-xs text-slate-500">How much of your income would you like to save over time?</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Change Aggressiveness</label>
        <select
          value={formData.changeAggressiveness}
          onChange={(e) => setFormData({ ...formData, changeAggressiveness: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="gentle">Gentle</option>
          <option value="balanced">Balanced</option>
          <option value="aggressive">Aggressive</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">How bold should we be when nudging your plan?</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium">Minimum Wants Floor</label>
          <span className="text-sm font-semibold">{(formData.wantsFloorPct * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[formData.wantsFloorPct * 100]}
          onValueChange={([value]) => setFormData({ ...formData, wantsFloorPct: value / 100 })}
          min={10}
          max={30}
          step={1}
          className="w-full"
        />
        <p className="mt-1 text-xs text-slate-500">Minimum share for fun & flexibility</p>
      </div>

      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}

function NotificationsEditor({ data, onUpdate, state }: { data: any; onUpdate: (updates: any) => void; state: any }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Channels</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.channels.email}
              onChange={(e) => setFormData({
                ...formData,
                channels: { ...formData.channels, email: e.target.checked }
              })}
              className="h-4 w-4"
            />
            <span>Email</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.channels.sms}
              onChange={(e) => setFormData({
                ...formData,
                channels: { ...formData.channels, sms: e.target.checked }
              })}
              className="h-4 w-4"
            />
            <span>SMS (future)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.channels.push}
              onChange={(e) => setFormData({
                ...formData,
                channels: { ...formData.channels, push: e.target.checked }
              })}
              className="h-4 w-4"
            />
            <span>Push notifications (future mobile app)</span>
          </label>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Types of notifications</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.types.criticalAlerts}
              onChange={(e) => setFormData({
                ...formData,
                types: { ...formData.types, criticalAlerts: e.target.checked }
              })}
              className="h-4 w-4"
            />
            <span>Critical alerts (cashflow risk, missed payments)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.types.savingsProgress}
              onChange={(e) => setFormData({
                ...formData,
                types: { ...formData.types, savingsProgress: e.target.checked }
              })}
              className="h-4 w-4"
            />
            <span>Savings & goal progress</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.types.opportunities}
              onChange={(e) => setFormData({
                ...formData,
                types: { ...formData.types, opportunities: e.target.checked }
              })}
              className="h-4 w-4"
            />
            <span>Opportunities & optimizations</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.types.education}
              onChange={(e) => setFormData({
                ...formData,
                types: { ...formData.types, education: e.target.checked }
              })}
              className="h-4 w-4"
            />
            <span>Education & tips</span>
          </label>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Frequency</label>
        <select
          value={formData.frequency}
          onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="important_only">Only important stuff</option>
          <option value="weekly">Weekly recap</option>
          <option value="frequent">More frequent nudges</option>
        </select>
      </div>

      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}

function RiskPreferencesEditor({ data, onUpdate, state }: { data: any; onUpdate: (updates: any) => void; state: any }) {
  const [formData, setFormData] = useState(data);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Risk Comfort</label>
        <select
          value={formData.riskComfort}
          onChange={(e) => setFormData({ ...formData, riskComfort: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="conservative">Conservative</option>
          <option value="balanced">Balanced</option>
          <option value="growth">Growth-oriented</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Time Horizon for Major Goals</label>
        <select
          value={formData.mainHorizon}
          onChange={(e) => setFormData({ ...formData, mainHorizon: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="short">&lt;5 years</option>
          <option value="medium">5–15 years</option>
          <option value="long">15+ years</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Crypto Stance (Optional)</label>
        <select
          value={formData.cryptoStance || 'avoid'}
          onChange={(e) => setFormData({ ...formData, cryptoStance: e.target.value })}
          className="w-full rounded border px-3 py-2"
        >
          <option value="avoid">No crypto</option>
          <option value="ok">Crypto is OK</option>
          <option value="friendly">Crypto-friendly</option>
        </select>
      </div>

      <Button onClick={() => onUpdate(formData)} className="w-full">Save Changes</Button>
    </div>
  );
}
