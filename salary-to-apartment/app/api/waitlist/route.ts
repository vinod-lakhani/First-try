import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, signupType, page } = body;

    // Validate required fields
    if (!email || !signupType || !page) {
      return NextResponse.json(
        { error: 'Missing required fields: email, signupType, and page are required' },
        { status: 400 }
      );
    }

    // Create timestamp
    const timestamp = new Date().toISOString();

    // Prepare data for storage
    const waitlistEntry = {
      email,
      signupType,
      page,
      timestamp,
    };

    // Store in local JSON file (MVP approach)
    const dataDir = path.join(process.cwd(), 'data');
    const waitlistFile = path.join(dataDir, 'waitlist.json');

    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(dataDir, { recursive: true });

      // Read existing waitlist data
      let waitlistData: any[] = [];
      try {
        const fileContent = await fs.readFile(waitlistFile, 'utf-8');
        waitlistData = JSON.parse(fileContent);
      } catch (error) {
        // File doesn't exist yet, start with empty array
        waitlistData = [];
      }

      // Append new entry
      waitlistData.push(waitlistEntry);

      // Write back to file
      await fs.writeFile(waitlistFile, JSON.stringify(waitlistData, null, 2), 'utf-8');
      
      console.log('[Waitlist API] Successfully saved to local file:', waitlistEntry);
    } catch (error) {
      console.error('[Waitlist API] Error saving to local file:', error);
      // Still return success to user
    }

    return NextResponse.json(
      { success: true, message: 'Successfully joined waitlist' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Waitlist API] Error processing waitlist signup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
