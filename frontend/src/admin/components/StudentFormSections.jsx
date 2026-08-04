import React from "react";
import { Users, BookOpen, Heart, FileDown, AlertCircle, ChevronDown, CheckCircle, Mail, Phone, Calendar, Hash } from "lucide-react";

// Reusable input component for consistency
const FormInput = ({ label, name, type = "text", value, onChange, placeholder, required = false, options = [], className = "", disabled = false }) => {
  const isSelect = options.length > 0;
  const inputClasses = "w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500";

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="flex items-center text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {isSelect ? (
        <div className="relative">
          <select
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className={`${inputClasses} appearance-none bg-white`}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          rows={2}
          disabled={disabled}
          className={`${inputClasses} resize-none`}
          placeholder={placeholder}
        />
      ) : type === "file" ? (
        <input
          type="file"
          name={name}
          accept="image/*"
          onChange={onChange}
          disabled={disabled}
          className={`${inputClasses} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100`}
        />
      ) : (
        <div className="relative">
          <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className={inputClasses}
            placeholder={placeholder}
          />
          {name === "email" && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Mail className="w-4 h-4 text-gray-400" /></div>}
          {name === "mobile" && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Phone className="w-4 h-4 text-gray-400" /></div>}
          {name === "dob" && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Calendar className="w-4 h-4 text-gray-400" /></div>}
          {name === "pincode" && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Hash className="w-4 h-4 text-gray-400" /></div>}
        </div>
      )}
    </div>
  );
};

export const PersonalInformationSection = ({ newStudent, handleAddStudentChange }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
        <Users className="w-3 h-3 text-yellow-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput label="Full Name" name="name" value={newStudent.name} onChange={handleAddStudentChange} required placeholder="Enter student's full name" />
      <FormInput label="Mobile Number" name="mobile" type="tel" value={newStudent.mobile} onChange={handleAddStudentChange} required placeholder="+91 98765 43210" />
      <FormInput label="Email Address" name="email" type="email" value={newStudent.email} onChange={handleAddStudentChange} placeholder="student@example.com" />
      <FormInput label="Date of Birth" name="dob" type="date" value={newStudent.dob} onChange={handleAddStudentChange} />
      <FormInput
        label="Gender"
        name="gender"
        value={newStudent.gender}
        onChange={handleAddStudentChange}
        required
        options={[
          { value: "", label: "Select Gender" },
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
          { value: "other", label: "Other" },
        ]}
      />
      <FormInput label="Pincode" name="pincode" value={newStudent.pincode} onChange={handleAddStudentChange} placeholder="Enter 6-digit pincode" maxLength={6} />
    </div>

    <FormInput label="Present Address" name="address" type="textarea" value={newStudent.address} onChange={handleAddStudentChange} placeholder="Enter complete present address..." />
    <FormInput label="Permanent Address" name="permanentAddress" type="textarea" value={newStudent.permanentAddress} onChange={handleAddStudentChange} placeholder="Enter complete permanent address..." />

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput label="Birth Place" name="birthPlace" value={newStudent.birthPlace} onChange={handleAddStudentChange} placeholder="City/Town of birth" />
      <FormInput label="Nationality" name="nationality" value={newStudent.nationality} onChange={handleAddStudentChange} placeholder="Nationality" />
      <FormInput label="Religion" name="religion" value={newStudent.religion} onChange={handleAddStudentChange} placeholder="Religion" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput label="Caste" name="caste" value={newStudent.caste} onChange={handleAddStudentChange} placeholder="Caste" />
      <FormInput
        label="Category"
        name="category"
        value={newStudent.category}
        onChange={handleAddStudentChange}
        options={[
          { value: "", label: "Select Category" },
          { value: "General", label: "General" },
          { value: "OBC", label: "OBC" },
          { value: "SC", label: "SC" },
          { value: "ST", label: "ST" },
          { value: "EWS", label: "EWS" },
          { value: "Other", label: "Other" },
        ]}
      />
    </div>

    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Student Photograph</label>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <FormInput
            name="photograph"
            type="file"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handleAddStudentChange({ target: { name: "photograph", value: file.name } });
              }
            }}
          />
        </div>
        {newStudent.photograph && (
          <div className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Uploaded
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">Upload a recent passport-size photograph (Max 2MB, JPG/PNG)</p>
    </div>
  </div>
);

export const ParentGuardianSection = ({ newStudent, handleAddStudentChange, parentSearchTerm, setParentSearchTerm, matchedParents, handleSelectExistingParent, selectedExistingParent }) => (
  <div className="space-y-6 pt-6 border-t border-gray-200">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
        <Users className="w-3 h-3 text-purple-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Parent/Guardian Details</h3>
    </div>

    <div className="space-y-2 relative">
      <label className="text-sm font-medium text-gray-700">Search Existing Parent (by name)</label>
      <input
        type="text"
        value={parentSearchTerm}
        onChange={(e) => {
          setParentSearchTerm(e.target.value);
          // Clear selected parent if search term changes
          if (selectedExistingParent && selectedExistingParent.name !== e.target.value) {
            handleSelectExistingParent(null);
          }
        }}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
        placeholder="Type parent name to link existing parent"
      />
      {selectedExistingParent && (
        <div className="text-xs text-green-700">
          Linked parent: {selectedExistingParent.name || "-"} ({selectedExistingParent.username || "-"})
        </div>
      )}
      {!selectedExistingParent && parentSearchTerm.trim() && matchedParents.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {matchedParents.map((parent) => (
            <button
              key={parent._id}
              type="button"
              onClick={() => handleSelectExistingParent(parent)}
              className="w-full text-left px-4 py-2 hover:bg-yellow-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="text-sm font-medium text-gray-800">{parent.name || "Unnamed Parent"}</div>
              <div className="text-xs text-gray-500">{parent.username || "-"} · {parent.mobile || "No mobile"}</div>
            </button>
          ))}
        </div>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput label="Guardian Login Name" name="guardianName" value={newStudent.guardianName} onChange={handleAddStudentChange} placeholder="Parent/Guardian full name" />
      <FormInput label="Guardian Login Phone" name="guardianPhone" type="tel" value={newStudent.guardianPhone} onChange={handleAddStudentChange} placeholder="+91 90000 00000" />
      <FormInput label="Guardian Login Email" name="guardianEmail" type="email" value={newStudent.guardianEmail} onChange={handleAddStudentChange} placeholder="guardian@example.com" />
      <FormInput label="Father's Name" name="fatherName" value={newStudent.fatherName} onChange={handleAddStudentChange} placeholder="Father's full name" />
      <FormInput label="Father's Phone" name="fatherPhone" type="tel" value={newStudent.fatherPhone} onChange={handleAddStudentChange} placeholder="+91 90000 00000" />
      <FormInput label="Father's Occupation" name="fatherOccupation" value={newStudent.fatherOccupation} onChange={handleAddStudentChange} placeholder="Occupation" />
      <FormInput label="Mother's Name" name="motherName" value={newStudent.motherName} onChange={handleAddStudentChange} placeholder="Mother's full name" />
      <FormInput label="Mother's Phone" name="motherPhone" type="tel" value={newStudent.motherPhone} onChange={handleAddStudentChange} placeholder="+91 90000 00000" />
      <FormInput label="Mother's Occupation" name="motherOccupation" value={newStudent.motherOccupation} onChange={handleAddStudentChange} placeholder="Occupation" />
    </div>
  </div>
);

export const AcademicAdmissionSection = ({ newStudent, handleAddStudentChange, academicYears, academicClasses, academicSections, selectedAcademicYearId, setSelectedAcademicYearId, selectedClassId, setSelectedClassId, selectedSectionId, setSelectedSectionId }) => {
  const addFormClassOptions = academicClasses.map((item) => ({ id: String(item._id), name: item.name }));
  const addFormSectionOptions = academicSections.filter((section) => String(section.classId) === String(selectedClassId)).map((item) => ({ id: String(item._id), name: item.name }));

  return (
    <div className="space-y-6 pt-6 border-t border-gray-200">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
          <BookOpen className="w-3 h-3 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Admission & Academic Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormInput label="Date of Admission" name="admissionDate" type="date" value={newStudent.admissionDate} onChange={handleAddStudentChange} required />
        <FormInput label="Admission Number" name="admissionNumber" value={newStudent.admissionNumber} onChange={handleAddStudentChange} placeholder="e.g., ADM/2024/001" />
        <FormInput
          label="Academic Session"
          name="academicYear"
          value={newStudent.academicYear}
          onChange={(e) => {
            const yearName = e.target.value;
            const selectedYear = academicYears.find(y => y.name === yearName);
            handleAddStudentChange({ target: { name: "academicYear", value: yearName } });
            setSelectedAcademicYearId(selectedYear?._id || '');
          }}
          options={[
            { value: "", label: "Select Session" },
            ...academicYears.map((year) => ({ value: year.name, label: year.name })),
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormInput
          label="Class"
          name="class"
          value={selectedClassId}
          onChange={(e) => {
            const nextClassId = e.target.value;
            const selectedClass = addFormClassOptions.find(item => item.id === nextClassId);
            setSelectedClassId(nextClassId);
            setSelectedSectionId("");
            handleAddStudentChange({ target: { name: "class", value: selectedClass?.name || "" } });
            handleAddStudentChange({ target: { name: "section", value: "" } }); // Clear section when class changes
          }}
          required
          options={[
            { value: "", label: "Select Class" },
            ...addFormClassOptions.map((classItem) => ({ value: classItem.id, label: classItem.name })),
          ]}
        />
        <FormInput
          label="Section"
          name="section"
          value={selectedSectionId}
          onChange={(e) => {
            const nextSectionId = e.target.value;
            const selectedSection = addFormSectionOptions.find(s => s.id === nextSectionId);
            setSelectedSectionId(nextSectionId);
            handleAddStudentChange({ target: { name: "section", value: selectedSection?.name || "" } });
          }}
          required
          options={[
            { value: "", label: "Select Section" },
            ...addFormSectionOptions.map((section) => ({ value: section.id, label: section.name })),
          ]}
          disabled={!selectedClassId}
        />
        <FormInput label="Roll Number" name="roll" value={newStudent.roll} onChange={handleAddStudentChange} required placeholder="Enter roll number" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label="Serial No" name="serialNo" type="number" value={newStudent.serialNo} onChange={handleAddStudentChange} placeholder="Serial number (optional)" />
        <FormInput
          label="Status"
          name="status"
          value={newStudent.status}
          onChange={handleAddStudentChange}
          options={[
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" },
            { value: "Alumni", label: "Alumni" },
            { value: "Dropped", label: "Dropped" },
          ]}
        />
      </div>
    </div>
  );
};

export const PreviousAcademicSection = ({ newStudent, handleAddStudentChange }) => (
  <div className="space-y-6 pt-6 border-t border-gray-200">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
        <BookOpen className="w-3 h-3 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Previous Academic History</h3>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput label="Previous School Name" name="previousSchoolName" value={newStudent.previousSchoolName} onChange={handleAddStudentChange} placeholder="Name of previous school" />
      <FormInput label="Class Last Attended" name="previousClass" value={newStudent.previousClass} onChange={handleAddStudentChange} placeholder="e.g., Class 10" />
      <FormInput label="Percentage Obtained" name="previousPercentage" type="number" value={newStudent.previousPercentage} onChange={handleAddStudentChange} min="0" max="100" step="0.01" placeholder="Percentage" />
      <FormInput label="Transfer Certificate No." name="transferCertificateNo" value={newStudent.transferCertificateNo} onChange={handleAddStudentChange} placeholder="TC Number" />
      <FormInput label="TC Date" name="transferCertificateDate" type="date" value={newStudent.transferCertificateDate} onChange={handleAddStudentChange} />
      <FormInput label="Reason for Leaving" name="reasonForLeaving" value={newStudent.reasonForLeaving} onChange={handleAddStudentChange} placeholder="Reason for leaving previous school" />
    </div>
  </div>
);

export const MedicalInformationSection = ({ newStudent, handleAddStudentChange }) => (
  <div className="space-y-6 pt-6 border-t border-gray-200">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
        <Heart className="w-3 h-3 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Medical Information</h3>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput
        label="Blood Group"
        name="bloodGroup"
        value={newStudent.bloodGroup}
        onChange={handleAddStudentChange}
        options={[
          { value: "", label: "Select Blood Group" },
          { value: "A+", label: "A+" }, { value: "A-", label: "A-" },
          { value: "B+", label: "B+" }, { value: "B-", label: "B-" },
          { value: "AB+", label: "AB+" }, { value: "AB-", label: "AB-" },
          { value: "O+", label: "O+" }, { value: "O-", label: "O-" },
          { value: "Unknown", label: "Unknown" },
        ]}
      />
      <FormInput label="Known Health Issues" name="knownHealthIssues" value={newStudent.knownHealthIssues} onChange={handleAddStudentChange} className="md:col-span-2" placeholder="Any known health conditions" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput label="Allergies" name="allergies" value={newStudent.allergies} onChange={handleAddStudentChange} placeholder="Any allergies" />
      <FormInput label="Immunization Status" name="immunizationStatus" value={newStudent.immunizationStatus} onChange={handleAddStudentChange} placeholder="Immunization completed/pending" />
      <FormInput label="Learning Disabilities" name="learningDisabilities" value={newStudent.learningDisabilities} onChange={handleAddStudentChange} placeholder="Any learning disabilities (if applicable)" />
    </div>
  </div>
);

export const DocumentInformationSection = ({ newStudent, handleAddStudentChange }) => (
  <div className="space-y-6 pt-6 border-t border-gray-200">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
        <FileDown className="w-3 h-3 text-indigo-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Document Information</h3>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput label="Aadhar Number" name="aadharNumber" value={newStudent.aadharNumber} onChange={handleAddStudentChange} placeholder="12-digit Aadhar number" maxLength={12} />
      <FormInput label="Birth Certificate No." name="birthCertificateNo" value={newStudent.birthCertificateNo} onChange={handleAddStudentChange} placeholder="Birth certificate number" />
    </div>
  </div>
);

export const OfficeUseSection = ({ newStudent, handleAddStudentChange }) => (
  <div className="space-y-6 pt-6 border-t border-gray-200">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
        <AlertCircle className="w-3 h-3 text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Office Use Only</h3>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormInput label="Application ID" name="applicationId" value={newStudent.applicationId} onChange={handleAddStudentChange} placeholder="Auto-generated" />
      <FormInput label="Application Date" name="applicationDate" type="date" value={newStudent.applicationDate} onChange={handleAddStudentChange} />
      <FormInput
        label="Approval Status"
        name="approvalStatus"
        value={newStudent.approvalStatus}
        onChange={handleAddStudentChange}
        options={[
          { value: "Pending", label: "Pending" },
          { value: "Under Review", label: "Under Review" },
          { value: "Approved", label: "Approved" },
          { value: "Rejected", label: "Rejected" },
        ]}
      />
    </div>

    <FormInput label="Remarks" name="remarks" type="textarea" value={newStudent.remarks} onChange={handleAddStudentChange} placeholder="Additional remarks or notes..." />
  </div>
);