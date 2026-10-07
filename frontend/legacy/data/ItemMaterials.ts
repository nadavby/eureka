export interface ItemMaterial {
    label: string;
    value: string;
  }
  
  export interface CategoryMaterials {
    categoryGroup: string;
    materials: ItemMaterial[];
  }
  
  export const itemMaterials: CategoryMaterials[] = [
    {
      categoryGroup: "Personal Items",
      materials: [
        { label: "Metal", value: "metal" },
        { label: "Plastic", value: "plastic" },
        { label: "Leather", value: "leather" },
        { label: "Fabric", value: "fabric" },
        { label: "Glass", value: "glass" },
        { label: "Rubber", value: "rubber" },
        { label: "Wood", value: "wood" },
        { label: "Paper", value: "paper" },
        { label: "Synthetic", value: "synthetic" },
        { label: "Mixed Materials", value: "mixed" }
      ]
    },
    {
      categoryGroup: "Electronics",
      materials: [
        { label: "Plastic", value: "plastic" },
        { label: "Metal (Aluminum)", value: "aluminum" },
        { label: "Metal (Steel)", value: "steel" },
        { label: "Glass", value: "glass" },
        { label: "Carbon Fiber", value: "carbon_fiber" },
        { label: "Silicone", value: "silicone" },
        { label: "Ceramic", value: "ceramic" },
        { label: "Mixed Materials", value: "mixed" }
      ]
    },
    {
      categoryGroup: "Bags & Luggage",
      materials: [
        { label: "Leather", value: "leather" },
        { label: "Canvas", value: "canvas" },
        { label: "Nylon", value: "nylon" },
        { label: "Polyester", value: "polyester" },
        { label: "Cotton", value: "cotton" },
        { label: "Synthetic Leather", value: "synthetic_leather" },
        { label: "Denim", value: "denim" },
        { label: "Vinyl", value: "vinyl" },
        { label: "Mixed Fabrics", value: "mixed_fabrics" }
      ]
    },
    {
      categoryGroup: "Documents & Cards",
      materials: [
        { label: "Paper", value: "paper" },
        { label: "Cardboard", value: "cardboard" },
        { label: "Plastic (PVC)", value: "pvc" },
        { label: "Laminated", value: "laminated" },
        { label: "Magnetic Strip", value: "magnetic" }
      ]
    },
    {
      categoryGroup: "Kids & Toys",
      materials: [
        { label: "Plastic", value: "plastic" },
        { label: "Fabric", value: "fabric" },
        { label: "Plush/Soft", value: "plush" },
        { label: "Wood", value: "wood" },
        { label: "Metal", value: "metal" },
        { label: "Rubber", value: "rubber" },
        { label: "Foam", value: "foam" },
        { label: "Mixed Materials", value: "mixed" }
      ]
    },
    {
      categoryGroup: "Animals",
      materials: [
        { label: "Fur", value: "fur" },
        { label: "Feathers", value: "feathers" },
        { label: "Scales", value: "scales" },
        { label: "Hair", value: "hair" }
      ]
    },
    {
      categoryGroup: "Medical Items",
      materials: [
        { label: "Plastic", value: "plastic" },
        { label: "Metal", value: "metal" },
        { label: "Glass", value: "glass" },
        { label: "Rubber", value: "rubber" },
        { label: "Silicone", value: "silicone" },
        { label: "Ceramic", value: "ceramic" }
      ]
    },
    {
      categoryGroup: "Sports & Outdoor Gear",
      materials: [
        { label: "Plastic", value: "plastic" },
        { label: "Metal", value: "metal" },
        { label: "Fabric", value: "fabric" },
        { label: "Rubber", value: "rubber" },
        { label: "Foam", value: "foam" },
        { label: "Carbon Fiber", value: "carbon_fiber" },
        { label: "Neoprene", value: "neoprene" },
        { label: "Leather", value: "leather" },
        { label: "Synthetic", value: "synthetic" }
      ]
    },
    {
      categoryGroup: "Musical Instruments",
      materials: [
        { label: "Wood", value: "wood" },
        { label: "Metal", value: "metal" },
        { label: "Plastic", value: "plastic" },
        { label: "String", value: "string" },
        { label: "Synthetic", value: "synthetic" },
        { label: "Composite", value: "composite" }
      ]
    },
    {
      categoryGroup: "Other",
      materials: [
        { label: "Metal", value: "metal" },
        { label: "Plastic", value: "plastic" },
        { label: "Wood", value: "wood" },
        { label: "Glass", value: "glass" },
        { label: "Fabric", value: "fabric" },
        { label: "Paper", value: "paper" },
        { label: "Rubber", value: "rubber" },
        { label: "Ceramic", value: "ceramic" },
        { label: "Stone", value: "stone" },
        { label: "Mixed Materials", value: "mixed" },
        { label: "Unknown", value: "unknown" }
      ]
    }
  ];
  
  export const getAvailableMaterials = (categoryGroup: string): ItemMaterial[] => {
    const category = itemMaterials.find(cat => cat.categoryGroup === categoryGroup);
    return category ? category.materials : [];
  };