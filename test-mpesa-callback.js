#!/usr/bin/env node
/**
 * M-Pesa Callback Testing Script
 * Tests whether the callback endpoint properly processes M-Pesa payment confirmations
 */

const BASE_URL = 'https://jkuat-online-queue.onrender.com';

async function test() {
  console.log('🧪 M-PESA CALLBACK FUNCTION TEST\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: Join a queue to get a queue entry
    console.log('\n✓ Step 1: Creating a queue entry...');
    const joinRes = await fetch(`${BASE_URL}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        studentId: 'TEST123',
        phone: '+254712345678',
        serviceType: 'registrar'
      })
    });

    if (!joinRes.ok) {
      throw new Error(`Failed to join queue: ${joinRes.statusText}`);
    }

    const queueEntry = await joinRes.json();
    const queueId = queueEntry.id;
    console.log(`   ✓ Created queue entry ID: ${queueId}`);
    console.log(`   ✓ Queue Number: #${queueEntry.queueNumber}`);

    // Step 2: Initiate M-Pesa payment (golden ticket)
    console.log('\n✓ Step 2: Initiating M-Pesa payment...');
    const payRes = await fetch(`${BASE_URL}/api/queue/${queueId}/mpesa-pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+254712345678'
      })
    });

    if (!payRes.ok) {
      throw new Error(`Failed to initiate payment: ${payRes.statusText}`);
    }

    const payData = await payRes.json();
    const goldenTicketRef = payData.goldenTicketRef;
    console.log(`   ✓ Payment initiated`);
    console.log(`   ✓ Golden Ticket Ref: ${goldenTicketRef}`);
    console.log(`   ✓ Status: ${payData.mpesaStatus} (should be "pending")`);

    if (payData.mpesaStatus !== 'pending') {
      throw new Error(`Expected mpesaStatus "pending", got "${payData.mpesaStatus}"`);
    }

    // Step 3: Check current status (should be pending)
    console.log('\n✓ Step 3: Checking payment status (should be pending)...');
    const statusRes1 = await fetch(`${BASE_URL}/api/queue/${queueId}/mpesa-status`);
    if (!statusRes1.ok) {
      throw new Error(`Failed to get status: ${statusRes1.statusText}`);
    }

    const status1 = await statusRes1.json();
    console.log(`   ✓ Current Status: ${status1.mpesaStatus}`);
    if (status1.mpesaStatus !== 'pending') {
      throw new Error(`Expected pending status, got: ${status1.mpesaStatus}`);
    }

    // Step 4: Send M-Pesa callback (SIMULATE SUCCESS)
    console.log('\n✓ Step 4: Sending M-Pesa callback (ResultCode: 0 = SUCCESS)...');
    const callbackRes = await fetch(`${BASE_URL}/api/queue/mpesa-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: 'TEST_MERCHANT_' + Date.now(),
            CheckoutRequestID: 'TEST_CHECKOUT_' + Date.now(),
            ResultCode: 0,
            ResultDesc: 'The service request has been processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 50 },
                { Name: 'MpesaReceiptNumber', Value: 'TEST' + Date.now() },
                { Name: 'TransactionDate', Value: '20260530105000' },
                { Name: 'PhoneNumber', Value: '254712345678' },
                { Name: 'AccountReference', Value: goldenTicketRef }
              ]
            }
          }
        }
      })
    });

    if (!callbackRes.ok) {
      throw new Error(`Callback request failed: ${callbackRes.statusText}`);
    }

    const callbackData = await callbackRes.json();
    console.log(`   ✓ Callback processed successfully`);
    console.log(`   ✓ Response: ${callbackData.message}`);

    // Step 5: Verify status changed to success
    console.log('\n✓ Step 5: Verifying payment status updated to "success"...');
    const statusRes2 = await fetch(`${BASE_URL}/api/queue/${queueId}/mpesa-status`);
    if (!statusRes2.ok) {
      throw new Error(`Failed to get final status: ${statusRes2.statusText}`);
    }

    const status2 = await statusRes2.json();
    console.log(`   ✓ Updated Status: ${status2.mpesaStatus}`);
    console.log(`   ✓ Transaction ID: ${status2.mpesaTransactionId}`);
    console.log(`   ✓ Paid At: ${status2.mpesaPaidAt}`);

    if (status2.mpesaStatus !== 'success') {
      throw new Error(`Expected success status, got: ${status2.mpesaStatus}`);
    }

    // Step 6: Test FAILURE callback
    console.log('\n✓ Step 6: Testing failure callback (creating new entry)...');
    const joinRes2 = await fetch(`${BASE_URL}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User 2',
        studentId: 'TEST124',
        phone: '+254712345679',
        serviceType: 'finance'
      })
    });

    const queueEntry2 = await joinRes2.json();
    const queueId2 = queueEntry2.id;

    // Initiate payment for second entry
    const payRes2 = await fetch(`${BASE_URL}/api/queue/${queueId2}/mpesa-pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+254712345679'
      })
    });

    const payData2 = await payRes2.json();
    const goldenTicketRef2 = payData2.goldenTicketRef;

    // Send FAILURE callback
    console.log('   ✓ Sending failure callback (ResultCode: 1 = FAILED)...');
    const failureRes = await fetch(`${BASE_URL}/api/queue/mpesa-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: 'TEST_FAIL_' + Date.now(),
            CheckoutRequestID: 'TEST_FAIL_' + Date.now(),
            ResultCode: 1,
            ResultDesc: 'The service request has been rejected by user.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 50 },
                { Name: 'MpesaReceiptNumber', Value: 'FAILED' + Date.now() },
                { Name: 'AccountReference', Value: goldenTicketRef2 }
              ]
            }
          }
        }
      })
    });

    if (!failureRes.ok) {
      throw new Error(`Failure callback request failed: ${failureRes.statusText}`);
    }

    // Verify status is failed
    const statusRes3 = await fetch(`${BASE_URL}/api/queue/${queueId2}/mpesa-status`);
    const status3 = await statusRes3.json();
    console.log(`   ✓ Status after failure callback: ${status3.mpesaStatus}`);

    if (status3.mpesaStatus !== 'failed') {
      throw new Error(`Expected failed status, got: ${status3.mpesaStatus}`);
    }

    // Step 7: Test error handling (invalid golden ticket ref)
    console.log('\n✓ Step 7: Testing error handling (invalid golden ticket ref)...');
    const invalidRes = await fetch(`${BASE_URL}/api/queue/mpesa-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Body: {
          stkCallback: {
            MerchantRequestID: 'TEST_INVALID',
            CheckoutRequestID: 'TEST_INVALID',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 50 },
                { Name: 'MpesaReceiptNumber', Value: 'INVALID' },
                { Name: 'AccountReference', Value: 'GT-INVALID-NONEXISTENT' }
              ]
            }
          }
        }
      })
    });

    const invalidData = await invalidRes.json();
    console.log(`   ✓ Response for invalid ref: ${invalidRes.status} ${invalidRes.statusText}`);
    console.log(`   ✓ Message: ${invalidData.message}`);

    if (invalidRes.status !== 404) {
      throw new Error(`Expected 404 for invalid ref, got: ${invalidRes.status}`);
    }

    // SUCCESS!
    console.log('\n' + '═'.repeat(60));
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  ✓ Callback receives and parses M-Pesa data correctly');
    console.log('  ✓ Callback updates database on success (ResultCode: 0)');
    console.log('  ✓ Callback updates database on failure (ResultCode: 1)');
    console.log('  ✓ Callback validates golden ticket reference');
    console.log('  ✓ Callback returns appropriate error responses');
    console.log('\n🎉 The M-Pesa callback function is working correctly!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:\n');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.log('\nDebugging Tips:');
    console.log('1. Check that the server is running');
    console.log('2. Verify the URL is accessible: ' + BASE_URL);
    console.log('3. Check server logs for errors');
    console.log('4. Ensure database is connected');
    process.exit(1);
  }
}

// Run tests
test();
