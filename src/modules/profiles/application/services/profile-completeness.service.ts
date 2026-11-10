import { Injectable } from '@nestjs/common';
import type {
  HousingPreference,
  LifestyleProfile,
  Profile,
  RoommatePreference,
} from '../../domain/entities/index.js';

export type CompletenessSection =
  | 'personal'
  | 'lifestyle'
  | 'roommate_preferences'
  | 'housing_preferences'
  | 'zones'
  | 'amenities';

export interface ProfileCompletenessInput {
  profile: Profile | null;
  lifestyle: LifestyleProfile | null;
  roommatePreferences: RoommatePreference | null;
  housingPreferences: HousingPreference | null;
  preferredZonesCount: number;
  preferredAmenitiesCount: number;
}

export interface MissingProfileField {
  section: CompletenessSection;
  field: string;
  label: string;
}

export interface ProfileCompletenessResult {
  completenessPct: number;
  missingFields: MissingProfileField[];
}

interface FieldRule<T> {
  field: string;
  label: string;
  weight: number;
  isComplete: (value: T | null) => boolean;
}

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  return typeof value !== 'string' || value.trim().length > 0;
};

/** Personal data: 8 fields × 5 points = 40. */
const PERSONAL_FIELDS: FieldRule<Profile>[] = [
  {
    field: 'firstName',
    label: 'Nombre',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.firstName),
  },
  {
    field: 'lastName',
    label: 'Apellidos',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.lastName),
  },
  {
    field: 'birthDate',
    label: 'Fecha de nacimiento',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.birthDate),
  },
  {
    field: 'bio',
    label: 'Biografía',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.bio),
  },
  {
    field: 'occupation',
    label: 'Ocupación',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.occupation),
  },
  {
    field: 'contactPhone',
    label: 'Teléfono de contacto',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.contactPhone),
  },
  {
    field: 'cityId',
    label: 'Ciudad',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.cityId),
  },
  {
    field: 'photoAssetId',
    label: 'Foto de perfil',
    weight: 5,
    isComplete: (profile) => hasValue(profile?.photoAssetId),
  },
];

/** Lifestyle: 5 fields × 4 points = 20. */
const LIFESTYLE_FIELDS: FieldRule<LifestyleProfile>[] = [
  {
    field: 'cleanlinessLevel',
    label: 'Nivel de limpieza',
    weight: 4,
    isComplete: (lifestyle) => hasValue(lifestyle?.cleanlinessLevel),
  },
  {
    field: 'smokes',
    label: '¿Fuma?',
    weight: 4,
    isComplete: (lifestyle) => hasValue(lifestyle?.smokes),
  },
  {
    field: 'hasPets',
    label: '¿Tiene mascotas?',
    weight: 4,
    isComplete: (lifestyle) => hasValue(lifestyle?.hasPets),
  },
  {
    field: 'noiseLevel',
    label: 'Tolerancia al ruido',
    weight: 4,
    isComplete: (lifestyle) => hasValue(lifestyle?.noiseLevel),
  },
  {
    field: 'visitsFrequency',
    label: 'Frecuencia de visitas',
    weight: 4,
    isComplete: (lifestyle) => hasValue(lifestyle?.visitsFrequency),
  },
];

/** Roommate preferences: 5 fields × 3 points = 15. */
const ROOMMATE_FIELDS: FieldRule<RoommatePreference>[] = [
  {
    field: 'smokingPolicy',
    label: 'Política sobre fumar',
    weight: 3,
    isComplete: (preferences) => hasValue(preferences?.smokingPolicy),
  },
  {
    field: 'petsPolicy',
    label: 'Política sobre mascotas',
    weight: 3,
    isComplete: (preferences) => hasValue(preferences?.petsPolicy),
  },
  {
    field: 'maxNoiseLevel',
    label: 'Nivel de ruido aceptado',
    weight: 3,
    isComplete: (preferences) => hasValue(preferences?.maxNoiseLevel),
  },
  {
    field: 'maxVisitsFrequency',
    label: 'Visitas aceptadas',
    weight: 3,
    isComplete: (preferences) => hasValue(preferences?.maxVisitsFrequency),
  },
  {
    field: 'minCleanlinessLevel',
    label: 'Limpieza mínima aceptada',
    weight: 3,
    isComplete: (preferences) => hasValue(preferences?.minCleanlinessLevel),
  },
];

/**
 * Single source of truth for the profile completeness formula.
 *
 * Weights sum to 100:
 * - personal data 40
 * - lifestyle 20
 * - roommate preferences 15
 * - housing preferences 15
 * - at least one preferred zone 5
 * - at least one preferred amenity 5
 */
@Injectable()
export class ProfileCompletenessService {
  calculate(input: ProfileCompletenessInput): ProfileCompletenessResult {
    const missingFields: MissingProfileField[] = [];
    let completenessPct = 0;

    for (const rule of PERSONAL_FIELDS) {
      if (rule.isComplete(input.profile)) {
        completenessPct += rule.weight;
      } else {
        missingFields.push({
          section: 'personal',
          field: rule.field,
          label: rule.label,
        });
      }
    }

    for (const rule of LIFESTYLE_FIELDS) {
      if (rule.isComplete(input.lifestyle)) {
        completenessPct += rule.weight;
      } else {
        missingFields.push({
          section: 'lifestyle',
          field: rule.field,
          label: rule.label,
        });
      }
    }

    for (const rule of ROOMMATE_FIELDS) {
      if (rule.isComplete(input.roommatePreferences)) {
        completenessPct += rule.weight;
      } else {
        missingFields.push({
          section: 'roommate_preferences',
          field: rule.field,
          label: rule.label,
        });
      }
    }

    const housing = input.housingPreferences;
    const housingRules: Array<{
      field: string;
      label: string;
      weight: number;
      isComplete: boolean;
    }> = [
      {
        field: 'propertyType',
        label: 'Tipo de inmueble',
        weight: 5,
        isComplete: hasValue(housing?.propertyType),
      },
      {
        field: 'budget',
        label: 'Presupuesto mínimo y máximo',
        weight: 5,
        isComplete: hasValue(housing?.budgetMin) && hasValue(housing?.budgetMax),
      },
      {
        field: 'moveInDate',
        label: 'Fecha de mudanza',
        weight: 5,
        isComplete: hasValue(housing?.moveInDate),
      },
    ];

    for (const rule of housingRules) {
      if (rule.isComplete) {
        completenessPct += rule.weight;
      } else {
        missingFields.push({
          section: 'housing_preferences',
          field: rule.field,
          label: rule.label,
        });
      }
    }

    if (input.preferredZonesCount > 0) {
      completenessPct += 5;
    } else {
      missingFields.push({
        section: 'zones',
        field: 'preferredZones',
        label: 'Al menos una zona de interés',
      });
    }

    if (input.preferredAmenitiesCount > 0) {
      completenessPct += 5;
    } else {
      missingFields.push({
        section: 'amenities',
        field: 'preferredAmenities',
        label: 'Al menos una amenidad deseada',
      });
    }

    return {
      completenessPct: Math.min(100, Math.max(0, completenessPct)),
      missingFields,
    };
  }
}
