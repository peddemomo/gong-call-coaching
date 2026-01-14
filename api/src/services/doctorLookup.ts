/**
 * Doctor Lookup Service
 * Uses the free NPI Registry API to search for doctors by name
 * API Docs: https://npiregistry.cms.hhs.gov/api-page
 */

export interface NPIDoctor {
  npi: string;
  name: string;
  firstName: string;
  lastName: string;
  credential: string;
  specialty: string;
  city: string;
  state: string;
  phone: string;
}

interface NPIAddress {
  city: string;
  state: string;
  telephone_number: string;
  address_purpose: string;
}

interface NPITaxonomy {
  desc: string;
  primary: boolean;
}

interface NPIBasic {
  first_name: string;
  last_name: string;
  credential?: string;
  name_prefix?: string;
}

interface NPIResult {
  number: string;
  basic: NPIBasic;
  addresses: NPIAddress[];
  taxonomies: NPITaxonomy[];
}

interface NPIResponse {
  result_count: number;
  results: NPIResult[];
}

/**
 * Parse a doctor name into first and last name components
 */
function parseDoctorName(name: string): { firstName?: string; lastName: string } {
  const cleaned = name
    .replace(/^(dr\.?|doctor)\s+/i, "") // Remove "Dr." or "Doctor" prefix
    .replace(/,?\s*(md|do|phd|np|pa|rn)\.?$/i, "") // Remove common credentials
    .trim();

  const parts = cleaned.split(/\s+/);

  if (parts.length === 1) {
    return { lastName: parts[0] };
  }

  // Last word is the last name, everything else is first name
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Search for doctors by name using the NPI Registry API
 */
export async function searchDoctors(doctorName: string): Promise<NPIDoctor[]> {
  const { firstName, lastName } = parseDoctorName(doctorName);

  const params = new URLSearchParams({
    version: "2.1",
    enumeration_type: "NPI-1", // Individual providers only
    last_name: lastName,
    limit: "50",
  });

  if (firstName) {
    // Use wildcard search for first name to catch variations
    params.set("first_name", firstName + "*");
  }

  const url = `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`NPI API returned ${response.status}`);
    }

    const data: NPIResponse = await response.json();

    if (!data.results || data.result_count === 0) {
      return [];
    }

    return data.results.map((result) => {
      const primaryLocation = result.addresses?.find(
        (a) => a.address_purpose === "LOCATION"
      ) || result.addresses?.[0];

      const primaryTaxonomy = result.taxonomies?.find((t) => t.primary) ||
        result.taxonomies?.[0];

      return {
        npi: result.number,
        name: `${result.basic.first_name} ${result.basic.last_name}`,
        firstName: result.basic.first_name,
        lastName: result.basic.last_name,
        credential: result.basic.credential || "",
        specialty: primaryTaxonomy?.desc || "Not specified",
        city: primaryLocation?.city || "",
        state: primaryLocation?.state || "",
        phone: formatPhone(primaryLocation?.telephone_number || ""),
      };
    });
  } catch (error) {
    console.error("Error searching NPI registry:", error);
    throw error;
  }
}

/**
 * Format phone number for display
 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
