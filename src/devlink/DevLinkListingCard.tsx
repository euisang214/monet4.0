import React from "react";

interface DevLinkListingCardProps {
    name?: string;
    title?: string;
    price?: string;
    image?: string;
    onViewProfileClick?: () => void;
    className?: string;
}

export function DevLinkListingCard({
    name = "Professional Name",
    title = "Job Title",
    price = "$100",
    image = "",
    onViewProfileClick,
    className = ""
}: DevLinkListingCardProps) {
    return (
        <div className={`border rounded-lg p-4 shadow-sm bg-white ${className}`}>
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                    {image ? <img src={image} alt={name} className="w-full h-full rounded-full object-cover" /> : name.charAt(0)}
                </div>
                <div>
                    <h3 className="font-semibold text-lg">{name}</h3>
                    <p className="text-sm text-gray-500">{title}</p>
                </div>
            </div>
            <div className="mb-4">
                <span className="font-medium text-lg">{price}</span>
                <span className="text-gray-500 text-sm"> / session</span>
            </div>
            <button
                onClick={onViewProfileClick}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
            >
                View Profile
            </button>
        </div>
    );
}
