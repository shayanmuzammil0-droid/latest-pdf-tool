import CompressPDFBase from "./CompressPDFBase";

interface CompressPDFDesktopProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

export default function CompressPDFDesktop({ onUploadScreenChange }: CompressPDFDesktopProps) {
  return <CompressPDFBase isMobile={false} onUploadScreenChange={onUploadScreenChange} />;
}