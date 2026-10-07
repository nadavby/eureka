// components/UserQRCode.tsx
import React from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  userId: string;
  showUrl?: boolean;
};

const UserQRCode: React.FC<Props> = ({ userId, showUrl = false }) => {
  const userProfileUrl = `${window.location.origin}/public-user/${userId}`;

  return (
    <div className="qr-code-container">
      <QRCodeSVG 
        value={userProfileUrl} 
        size={200}
        level="H"
        includeMargin={true}
        style={{
          padding: '8px',
          borderRadius: '8px',
        }}
      />
      {showUrl && (
        <p className="text-sm text-gray-500 text-center break-all mt-2">{userProfileUrl}</p>
      )}
    </div>
  );
};

export default UserQRCode;