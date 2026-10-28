import { Field } from './UI';
export default function AddressFields({ register, errors = {}, prefix = 'address.' }) {
  return (
    <div className="form-grid">
      {[
        ['name', 'Recipient name'],
        ['phone', 'Phone number'],
        ['line1', 'Street address'],
        ['line2', 'Apartment / unit (optional)'],
        ['city', 'City'],
        ['province', 'Province'],
        ['postalCode', 'Postal code'],
      ].map(([key, label]) => (
        <Field key={key} label={label} error={errors[key]}>
          <input
            autoComplete={
              {
                name: 'shipping name',
                phone: 'shipping tel',
                line1: 'shipping address-line1',
                line2: 'shipping address-line2',
                city: 'shipping address-level2',
                province: 'shipping address-level1',
                postalCode: 'shipping postal-code',
              }[key]
            }
            {...register(prefix + key, {
              required: key === 'line2' ? false : 'This field is required',
              maxLength: 200,
            })}
          />
        </Field>
      ))}
      <Field label="Country">
        <select {...register(prefix + 'country')}>
          <option value="ZA">South Africa</option>
        </select>
      </Field>
    </div>
  );
}
