/**
 * Simple script to verify PDF functionality
 * This will test the PDF generation endpoint directly
 */

async function testPDFGeneration() {
  try {
    console.log("🧪 Testing PDF generation endpoint...");

    const testData = {
      values: {
        'form1[0].#subform[68].TextField11[1]': 'TestFirst',
        'form1[0].Sections1-6[0].RadioButtonList[0]': 'YES',
        'form1[0].Sections1-6[0].suffix[0]': 'Jr'
      }
    };

    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log("📊 Response status:", response.status);
    console.log("📊 Response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log("📄 Blob size:", blob.size, "bytes");
    console.log("📄 Blob type:", blob.type);

    // Save the test PDF
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-sf86-verification.pdf';
    a.click();
    URL.revokeObjectURL(url);

    console.log("✅ Test PDF saved to downloads");
    console.log("💡 Please check the downloaded PDF for the test values:");
    console.log("   - First name should be: TestFirst");
    console.log("   - Radio button should be: YES");
    console.log("   - Suffix should be: Jr");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test if in browser environment
if (typeof window !== 'undefined') {
  // testPDFGeneration(); // Uncomment to run automatically
  console.log("🔧 Run testPDFGeneration() in browser console to test PDF generation");
} else {
  console.log("This script should be run in a browser environment");
}