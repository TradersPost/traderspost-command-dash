import { useState, useEffect } from 'react'

interface WebhookSettingsData {
  webhookUrl: string
  buyMessage: string
  sellMessage: string
  enabled: boolean
  signalTime: string
  threshold: number
}

interface WebhookSettingsProps {
  open: boolean
  onClose: () => void
}

export function WebhookSettingsPanel({ open, onClose }: WebhookSettingsProps) {
  const [settings, setSettings] = useState<WebhookSettingsData>({
    webhookUrl: '',
    buyMessage: '{"action":"buy"}',
    sellMessage: '{"action":"sell"}',
    enabled: false,
    signalTime: '09:30',
    threshold: 0.10
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      window.api.getWebhookSettings().then((s) => {
        setSettings(s as WebhookSettingsData)
      })
      setSaved(false)
    }
  }, [open])

  const handleSave = async () => {
    await window.api.saveWebhookSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = (field: keyof WebhookSettingsData, value: string | boolean | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 bg-bg-deep flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
        <span className="text-[13px] font-semibold text-text-primary">Webhook Settings</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-text-dim hover:bg-bg-elevated hover:text-text-secondary"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3 flex-1">
        {/* Enable toggle */}
        <label className="flex items-center justify-between">
          <span className="text-[11px] text-text-secondary font-medium">Signal Enabled</span>
          <button
            onClick={() => update('enabled', !settings.enabled)}
            className={`w-9 h-5 rounded-full transition-colors relative ${
              settings.enabled ? 'bg-accent' : 'bg-bg-elevated'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-[left] ${
                settings.enabled ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </label>

        {/* Webhook URL */}
        <div>
          <label className="text-[11px] text-text-secondary font-medium block mb-1">
            TradersPost Webhook URL
          </label>
          <input
            type="text"
            value={settings.webhookUrl}
            onChange={(e) => update('webhookUrl', e.target.value)}
            placeholder="https://webhooks.traderspost.io/trading/webhook/..."
            className="w-full rounded bg-bg-elevated border border-border px-2 py-1.5 text-[11px] text-text-primary placeholder:text-text-dim font-mono outline-none focus:border-accent"
          />
        </div>

        {/* Signal Time */}
        <div>
          <label className="text-[11px] text-text-secondary font-medium block mb-1">
            Signal Time (ET, 24h)
          </label>
          <input
            type="text"
            value={settings.signalTime}
            onChange={(e) => update('signalTime', e.target.value)}
            placeholder="09:30"
            className="w-full rounded bg-bg-elevated border border-border px-2 py-1.5 text-[11px] text-text-primary placeholder:text-text-dim font-mono outline-none focus:border-accent"
          />
        </div>

        {/* Threshold */}
        <div>
          <label className="text-[11px] text-text-secondary font-medium block mb-1">
            Threshold ({Math.round(settings.threshold * 100)}% spread required)
          </label>
          <input
            type="range"
            min="0.01"
            max="0.50"
            step="0.01"
            value={settings.threshold}
            onChange={(e) => update('threshold', parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        {/* Buy Message */}
        <div>
          <label className="text-[11px] text-text-secondary font-medium block mb-1">
            Buy Message (JSON)
          </label>
          <textarea
            value={settings.buyMessage}
            onChange={(e) => update('buyMessage', e.target.value)}
            rows={2}
            className="w-full rounded bg-bg-elevated border border-border px-2 py-1.5 text-[11px] text-text-primary font-mono outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Sell Message */}
        <div>
          <label className="text-[11px] text-text-secondary font-medium block mb-1">
            Sell Message (JSON)
          </label>
          <textarea
            value={settings.sellMessage}
            onChange={(e) => update('sellMessage', e.target.value)}
            rows={2}
            className="w-full rounded bg-bg-elevated border border-border px-2 py-1.5 text-[11px] text-text-primary font-mono outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full rounded py-2 text-[12px] font-medium transition-colors ${
            saved
              ? 'bg-green-600/20 text-green-400'
              : 'bg-accent text-white hover:bg-accent/80'
          }`}
        >
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
