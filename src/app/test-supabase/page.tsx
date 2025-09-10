'use client'

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export default function TestSupabase() {
  const [connectionStatus, setConnectionStatus] = useState<string>('Testing...')
  const [error, setError] = useState<string | null>(null)
  const [tables, setTables] = useState<any[]>([])

  useEffect(() => {
    async function testConnection() {
      try {
        // Test basic connection with a simple query
        const { error } = await supabase.auth.getSession()
        
        if (error) {
          setConnectionStatus('❌ Connection Failed')
          setError(error.message)
        } else {
          setConnectionStatus('✅ Connection Successful')
          
          // Try to get user info
          const { data: userData } = await supabase.auth.getUser()
          if (userData) {
            setTables([{ info: 'Auth service working', user: userData.user?.email || 'Anonymous' }])
          }
        }
      } catch (err) {
        setConnectionStatus('❌ Connection Error')
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Supabase Connection Test</h1>
      
      <div className="space-y-4">
        <div className="bg-card p-4 rounded-lg border">
          <h2 className="text-xl font-semibold mb-2">Configuration</h2>
          <p><strong>URL:</strong> {supabaseUrl}</p>
          <p><strong>Key:</strong> {supabaseKey.substring(0, 20)}...</p>
        </div>

        <div className="bg-card p-4 rounded-lg border">
          <h2 className="text-xl font-semibold mb-2">Connection Status</h2>
          <p className="text-lg">{connectionStatus}</p>
          {error && (
            <div className="mt-2 p-2 bg-destructive/20 rounded border border-destructive">
              <p className="text-destructive"><strong>Error:</strong> {error}</p>
            </div>
          )}
        </div>

        {tables.length > 0 && (
          <div className="bg-card p-4 rounded-lg border">
            <h2 className="text-xl font-semibold mb-2">Connection Details</h2>
            <ul className="list-disc list-inside">
              {tables.map((table, index) => (
                <li key={index}>
                  {table.info}: {table.user}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-card p-4 rounded-lg border">
          <h2 className="text-xl font-semibold mb-2">Next Steps</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>If connection is successful, you can create tables in Supabase dashboard</li>
            <li>Create a &apos;jobs&apos; table for your job management</li>
            <li>Create a &apos;users&apos; table for user data</li>
            <li>Create a &apos;logs&apos; table for activity logs</li>
            <li>Set up Row Level Security policies for data access</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
