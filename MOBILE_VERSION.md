# PDF Split Tool - Mobile Version

## Overview
A beautiful, touch-friendly mobile version of the PDF split tool has been created specifically for mobile users. The app automatically detects mobile devices and loads the optimized interface while keeping the full desktop experience for larger screens.

## Features

### 🎯 Three Split Modes
1. **Pick Pages** - Select individual pages visually or by page numbers
   - Select pages one by one with visual thumbnails
   - Quick actions: Select All, Deselect All, Invert selection
   - Option to merge all selected pages into one PDF or keep separate

2. **Page Ranges** - Create custom or fixed page ranges
   - Custom ranges: Define exactly which pages go into each file
   - Fixed ranges: Automatically split every N pages
   - Merge all ranges into a single PDF or keep as separate files

3. **File Size** - Split by maximum file size
   - Set maximum file size (KB or MB)
   - Optional compression for smaller files
   - Auto-corrects invalid inputs to safe minimums

### 📱 Mobile-Optimized Design
- **Touch-Friendly**: Large buttons and tap targets (minimum 44px height)
- **Vertical Layout**: Everything stacks vertically for easy scrolling
- **Bottom Sheet Navigation**: Modal settings panel for easy access
- **Clear Visual Feedback**: Selection indicators and status messages
- **Page Thumbnails**: Visual preview of each page with selection state

### 🎨 UI/UX Highlights
- Gradient backgrounds and smooth transitions
- Color-coded sections for better organization
- Large, readable typography optimized for small screens
- Fast, responsive interactions with active states
- Toast notifications for user feedback
- Loading states and progress indicators

## File Structure

```
src/pages/
├── SplitPDF.tsx         # Desktop version (complex layout)
├── SplitPDFMobile.tsx   # Mobile version (new - touch-optimized)
```

## How It Works

### Automatic Detection
The app uses the `useIsMobile()` hook to detect device size:
- Mobile devices (< 768px width) → Load `SplitPDFMobile`
- Desktop devices (≥ 768px width) → Load `SplitPDF`

### Mobile Component Features

#### Upload Screen
- Drag-and-drop or tap to select PDF file
- Visual PDF icon animation
- Clear instructions and feature badges

#### Page Preview
- Scrollable list of all PDF pages
- Page thumbnails with visual indicators
- Selection status per page
- Page count tracking

#### Split Settings (Bottom Sheet)
- Tab-based navigation for split modes
- Compact controls for each mode
- Quick action buttons
- Toggle options for compression and merging

#### Download
- Single PDF download for merged/simple splits
- ZIP file download for multiple files
- Success notifications

## Technical Implementation

### Key Functions
- **`loadPdf()`** - Load and parse PDF, generate thumbnails
- **`splitPdf()`** - Execute split operation with appropriate mode
- **`calculateSizeMinimums()`** - Compute safe file size limits
- **`clampSizeValue()`** - Validate and correct user input
- **`parseRange()`** - Parse page range input (e.g., "1,3-5,7")

### Libraries & Dependencies
- **pdf-lib** - PDF creation and manipulation
- **pdfjs-dist** - PDF rendering for thumbnails
- **jszip** - ZIP file generation for multiple files
- **lucide-react** - Icons
- **tailwindcss** - Styling

## Mobile-Specific Optimizations

### Performance
- Lazy thumbnail rendering
- Efficient state management
- Minimal re-renders with useCallback
- Optimized image compression (0.6 quality)

### Touch Interaction
- Touch sensors enabled in drag-and-drop context
- 120ms delay for long-press detection
- Active states for visual feedback
- Larger tap targets than desktop version

### Responsive Design
- Safe area insets for notched devices
- Full viewport utilization
- Scrollable content areas with proper padding
- Fixed buttons at bottom for easy access

## Usage

The mobile version is automatically loaded on:
- Phones (iOS and Android)
- Tablets in portrait mode
- Any device with viewport width < 768px

Users can still access the desktop version by:
- Rotating their device to landscape on tablets
- Resizing their browser window to desktop size

## Styling

The mobile version uses:
- **Color Scheme**: Blue (#3b82f6, #4f46e5) accents on light background
- **Typography**: Larger text sizes optimized for mobile (16px minimum)
- **Spacing**: Generous padding and margins for mobile comfort
- **Layout**: Single column, vertical stacking
- **Animations**: Smooth transitions with GPU acceleration

## Future Enhancements

Potential additions:
- Dark mode support
- PWA (Progressive Web App) features
- Page reordering via drag-and-drop on mobile
- Advanced PDF editing features
- Batch processing
- File history/recent files

## Testing Checklist

When testing the mobile version:
- ✅ Upload PDF successfully
- ✅ View all page thumbnails
- ✅ Select/deselect pages
- ✅ Create custom ranges
- ✅ Split and download files
- ✅ Test with large PDFs (100+ pages)
- ✅ Test on various mobile devices
- ✅ Test in portrait and landscape

## Browser Support

- iOS Safari (iOS 13+)
- Android Chrome
- Android Firefox
- Samsung Internet
- Any modern browser with Web APIs support

## Accessibility

The mobile version includes:
- Semantic HTML structure
- ARIA labels for interactive elements
- High contrast color scheme
- Touch target sizing (minimum 44px)
- Clear visual feedback for all actions
