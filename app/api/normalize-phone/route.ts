import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Import the normalizePhone function
    const { normalizePhone } = await import('@/utils/phoneUtils');
    const normalizedPhone = normalizePhone(phone);

    return NextResponse.json({ 
      original: phone,
      normalized: normalizedPhone 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to normalize phone number' },
      { status: 500 }
    );
  }
}