import CompressPDFBase from "./CompressPDFBase";

interface CompressPDFMobileProps {
  onUploadScreenChange?: (isUploadScreen: boolean) => void;
}

export default function CompressPDFMobile({ onUploadScreenChange }: CompressPDFMobileProps) {
  return <CompressPDFBase isMobile={true} onUploadScreenChange={onUploadScreenChange} />;
}