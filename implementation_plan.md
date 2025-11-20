# Implementation Plan - Move Heading to Hamburger Menu

## Goal
Move the main "OurShow" heading/branding into the hamburger menu on mobile devices, creating a cleaner main header.

## Proposed Changes

### `index.html`

#### [MODIFY] Main Header Logo
- Change visibility of the main logo anchor tag from `flex` to `hidden md:flex`.
- This will hide the logo on mobile screens.

#### [MODIFY] Mobile Menu Content
- Enhance the logo section inside the mobile menu (`#mobile-menu`) to include the tagline ("discover • discuss • recommend") so it fully matches the main branding.
- Ensure the mobile menu button is positioned correctly (likely on the right side of the screen).

## Verification Plan

### Manual Verification
- Open the site on a mobile viewport (or resize browser).
- Verify the main header does NOT show the "OurShow" logo.
- Verify the hamburger menu button is visible.
- Open the hamburger menu.
- Verify the "OurShow" logo AND tagline are visible inside the menu.
- Verify desktop view remains unchanged (logo visible).
