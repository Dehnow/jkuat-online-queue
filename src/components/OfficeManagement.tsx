import { useState } from 'react'
import { X, Plus, Trash2, Edit2 } from 'lucide-react'

type Office = {
  id: number
  name: string
  serviceType: string
  status: 'open' | 'closed'
  username: string
}

interface OfficeManagementProps {
  offices: Office[]
  onCreateOffice: (data: any) => Promise<void>
  onDeleteOffice: (officeId: number) => Promise<void>
  onEditOffice: (office: Office) => Promise<void>
  adminAuth: string
}

export default function OfficeManagement({ offices, onCreateOffice, onDeleteOffice, onEditOffice, adminAuth }: OfficeManagementProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1)
  const [formData, setFormData] = useState({
    name: '',
    serviceType: 'registrar',
    username: '',
    password: '',
    confirmPassword: '',
  })

  const serviceOptions = [
    { value: 'registrar', label: "Registrar's Office" },
    { value: 'finance', label: 'Finance Office' },
    { value: 'ict_helpdesk', label: 'ICT Helpdesk' },
  ]

  const handleNextStep = () => {
    if (wizardStep < 4) setWizardStep((wizardStep + 1) as 1 | 2 | 3 | 4)
  }

  const handlePrevStep = () => {
    if (wizardStep > 1) setWizardStep((wizardStep - 1) as 1 | 2 | 3 | 4)
  }

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin/offices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${adminAuth}`,
        },
        body: JSON.stringify({
          name: formData.name,
          serviceType: formData.serviceType,
          username: formData.username,
          password: formData.password,
        }),
      })

      if (res.ok) {
        await onCreateOffice(formData)
        setFormData({ name: '', serviceType: 'registrar', username: '', password: '', confirmPassword: '' })
        setWizardStep(1)
        setShowWizard(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create office')
      }
    } catch (err) {
      setError('Network error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOffice = async () => {
    if (!selectedOffice) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/offices', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${adminAuth}`,
        },
        body: JSON.stringify({ officeId: selectedOffice.id }),
      })

      if (res.ok) {
        await onDeleteOffice(selectedOffice.id)
        setShowDeleteConfirm(false)
        setSelectedOffice(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete office')
      }
    } catch (err) {
      setError('Network error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Manage Offices</h2>
        <button
          onClick={() => {
            setShowWizard(true)
            setWizardStep(1)
            setFormData({ name: '', serviceType: 'registrar', username: '', password: '', confirmPassword: '' })
            setError('')
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Add New Office
        </button>
      </div>

      {/* Offices List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offices.map((office) => (
          <div key={office.id} className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600 hover:shadow-xl transition-all">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{office.name}</h3>
                <p className="text-sm text-gray-600">{serviceOptions.find(s => s.value === office.serviceType)?.label}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${office.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {office.status.toUpperCase()}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-xs text-gray-600">Username</p>
              <p className="text-sm font-mono font-semibold text-gray-800">{office.username}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedOffice(office)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-semibold transition-all"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => {
                  setSelectedOffice(office)
                  setShowDeleteConfirm(true)
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Office Setup Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Office Setup Wizard</h3>
              <button
                onClick={() => setShowWizard(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-8">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex-1 flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      step <= wizardStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step}
                  </div>
                  {step < 4 && <div className={`flex-1 h-1 mx-2 ${step < wizardStep ? 'bg-blue-600' : 'bg-gray-200'}`}></div>}
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateOffice} className="space-y-6">
              {/* Step 1: Office Name */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800">Step 1: Office Name</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Office Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Main Registrar Office"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Service Type */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800">Step 2: Service Station</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Service Type</label>
                    <div className="grid grid-cols-1 gap-3">
                      {serviceOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, serviceType: option.value })}
                          className={`p-4 rounded-lg border-2 text-left font-semibold transition-all ${
                            formData.serviceType === option.value
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Credentials */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800">Step 3: Office Login Credentials</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Office login username"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Office login password"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800">Step 4: Review & Deploy</h4>
                  <div className="bg-gray-50 p-6 rounded-lg space-y-3">
                    <div>
                      <p className="text-xs text-gray-600">Office Name</p>
                      <p className="text-lg font-semibold text-gray-800">{formData.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Service Type</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {serviceOptions.find(s => s.value === formData.serviceType)?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Username</p>
                      <p className="text-lg font-mono font-semibold text-gray-800">{formData.username}</p>
                    </div>
                  </div>
                  <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>Important:</strong> Please remember these credentials. They will be used by staff to access this office dashboard.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-6">
                {wizardStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Back
                  </button>
                )}
                {wizardStep < 4 && (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                  >
                    Next
                  </button>
                )}
                {wizardStep === 4 && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Deploying...' : 'Deploy Office'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedOffice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Delete Office?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedOffice.name}</strong>? This action cannot be undone.
            </p>
            {error && (
              <div className="p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setSelectedOffice(null)
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOffice}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
