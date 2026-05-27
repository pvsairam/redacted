# How to Test the QA Platform

Follow this step-by-step guide to successfully record a test, ensure video is captured, replay the test, and view your results and video!

## Step 1: Prepare the Extension
1. Click the **Extension Icon** in your Chrome toolbar to open the popup.
2. Ensure you see the green **Connected** pill in the top right.
3. Under **Execution Settings**, check the box for **"Record Video Replay"**. 
   *(Note: This auto-saves instantly! You do not need to click a save button).*

## Step 2: Record a Test
We recommend testing on a site that does not aggressively block bots (like Google does). `saucedemo.com` is a perfect testing ground.

1. Open a new tab and navigate to `https://www.saucedemo.com`
2. Open the extension popup, enter a test name (e.g., "Sauce Login"), and click **Start Recording**.
3. You will see a small recording overlay appear on the screen.
4. Type `standard_user` into the username field.
5. Type `secret_sauce` into the password field.
6. Click the **Login** button.
7. Open the extension popup again and click **Stop**.

## Step 3: Replay the Test
1. Go to your **Dashboard** (`http://localhost:3000`).
2. Click on the **Tests** tab on the left sidebar.
3. Click on the test you just recorded ("Sauce Login").
4. In the top right corner, click the white **Replay** button.
5. Wait for the engine to finish running the test in the background.

## Step 4: Where to Find the Video
This is the most important part! The video is attached to the **Run Details**, not the Test Case.

1. On your Dashboard homepage, look at the **Recent Runs** table.
2. On the far right side of the row for your recent run, click the **"View →"** link.
3. You are now on the **Run Details** page.
4. Scroll down past the Metadata boxes.
5. You will see two tabs: **Execution Logs** and **Screenshots**.
6. **Scroll down to the very bottom of the page**, just below the screenshots area.
7. You will see a header that says **"Recording"** with a video player right below it!

> [!TIP]
> If a test fails (like on Google or Amazon when they block automated browsers), the video will still be generated! It is incredibly useful for seeing exactly what the bot saw right before it got blocked.
