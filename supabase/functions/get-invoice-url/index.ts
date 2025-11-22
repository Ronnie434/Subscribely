import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Parse request body
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invoice ID is required' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Retrieve invoice from Stripe
    const invoice = await stripe.invoices.retrieve(invoiceId);

    if (!invoice) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invoice not found' 
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Return hosted invoice URL (doesn't expire)
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: invoice.hosted_invoice_url || invoice.invoice_pdf,
          pdfUrl: invoice.invoice_pdf,
        },
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  } catch (error) {
    console.error('Error fetching invoice:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve invoice'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});