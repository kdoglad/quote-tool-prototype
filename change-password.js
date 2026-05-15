import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL?.replace('/rest/v1/', '')
const key = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(url, key)

async function change() {
    const email = 'admin@sce.com'
    const oldPassword = 'Password123!'
    const newPassword = 'scepword123!'

    console.log(`Signing in as ${email}...`)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword
    })

    if (signInError) {
        console.error('Sign in failed:', signInError.message)
        return
    }

    console.log(`Updating password to ${newPassword}...`)
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword
    })

    if (updateError) {
        console.error('Update failed:', updateError.message)
    } else {
        console.log('Password successfully changed to ' + newPassword)
    }
}
change()
