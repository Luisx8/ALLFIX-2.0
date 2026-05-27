package ph.allfix.service;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class SlotService {

    private final FirestoreService firestoreService;

    public SlotService(FirestoreService firestoreService) {
        this.firestoreService = firestoreService;
    }

    public List<Map<String, Object>> getVendorSlots(String vendorId) throws Exception {
        return firestoreService.getWhere("vendor_slots", "vendor_id", vendorId);
    }

    public String createSlot(Map<String, Object> data) throws Exception {
        return firestoreService.create("vendor_slots", data);
    }

    public void decrementSlot(String vendorId, String date) throws Exception {
        decrementSlot(vendorId, date, null, null);
    }

    public void decrementSlot(String vendorId, String date, String subService, String time) throws Exception {
        Map<String, Object> filters = new HashMap<>();
        filters.put("vendor_id", vendorId);
        filters.put("slot_date", date);
        if (subService != null && !subService.isEmpty()) {
            filters.put("sub_service", subService);
        }
        List<Map<String, Object>> slots = firestoreService.getWhereMultiple("vendor_slots", filters);

        if (!slots.isEmpty()) {
            Map<String, Object> targetSlot = null;
            if (time != null && !time.isEmpty()) {
                for (Map<String, Object> slot : slots) {
                    String timeFrom = (String) slot.get("time_from");
                    String timeTo = (String) slot.get("time_to");
                    if (timeFrom != null && timeTo != null) {
                        if (isTimeWithinRange(time, timeFrom, timeTo)) {
                            targetSlot = slot;
                            break;
                        }
                    }
                }
            }
            if (targetSlot == null) {
                targetSlot = slots.get(0);
            }
            String slotId = (String) targetSlot.get("id");
            int available = ((Number) targetSlot.getOrDefault("available_slots", 0)).intValue();
            if (available > 0) {
                firestoreService.increment("vendor_slots", slotId, "available_slots", -1);
            }
        }
    }

    public List<Map<String, Object>> getAvailableVendors(String serviceType, String date) throws Exception {
        // Get all vendor slots for the date with available > 0
        List<Map<String, Object>> slots = firestoreService.getWhere("vendor_slots", "slot_date", date);
        List<String> vendorIds = new ArrayList<>();
        for (Map<String, Object> slot : slots) {
            int available = ((Number) slot.getOrDefault("available_slots", 0)).intValue();
            if (available > 0) vendorIds.add((String) slot.get("vendor_id"));
        }

        // Get vendors matching service type and in the available list
        List<Map<String, Object>> vendors = firestoreService.getWhere("vendors", "service_type", serviceType);
        return vendors.stream()
                .filter(v -> Boolean.TRUE.equals(v.get("is_approved")) && vendorIds.contains(v.get("id")))
                .toList();
    }

    public List<Map<String, Object>> getAvailableBySubService(String serviceType, String subService, String date) throws Exception {
        // Get all vendor slots for the date with service/sub-service match and available > 0
        List<Map<String, Object>> slots = firestoreService.getWhere("vendor_slots", "slot_date", date);
        List<String> vendorIds = new ArrayList<>();
        for (Map<String, Object> slot : slots) {
            int available = ((Number) slot.getOrDefault("available_slots", 0)).intValue();
            String slotService = (String) slot.get("service_type");
            String slotSubService = (String) slot.get("sub_service");
            if (available > 0 && serviceType.equals(slotService) && subService.equals(slotSubService)) {
                vendorIds.add((String) slot.get("vendor_id"));
            }
        }

        // Get vendors matching service type and in the available list
        List<Map<String, Object>> vendors = firestoreService.getWhere("vendors", "service_type", serviceType);
        return vendors.stream()
                .filter(v -> Boolean.TRUE.equals(v.get("is_approved")) && vendorIds.contains(v.get("id")))
                .toList();
    }

    public List<Map<String, Object>> getAvailableVendorsForSchedule(String serviceName, String serviceBrand, String subService, String workType, String date, String time) throws Exception {
        // Get all vendor slots for the date with available > 0
        List<Map<String, Object>> slots = firestoreService.getWhere("vendor_slots", "slot_date", date);
        List<String> vendorIds = new ArrayList<>();
        for (Map<String, Object> slot : slots) {
            int available = ((Number) slot.getOrDefault("available_slots", 0)).intValue();
            if (available <= 0) continue;
            
            // Check that the slot matches the selected subservice and service category
            String slotService = (String) slot.get("service_type");
            String slotSubService = (String) slot.get("sub_service");
            
            boolean serviceMatches = false;
            if (slotService != null) {
                if (serviceName != null && slotService.equalsIgnoreCase(serviceName)) serviceMatches = true;
                if (serviceBrand != null && slotService.equalsIgnoreCase(serviceBrand)) serviceMatches = true;
            }
            
            boolean subServiceMatches = false;
            if (subService == null || subService.isEmpty() || "null".equalsIgnoreCase(subService)) {
                subServiceMatches = (slotSubService == null || slotSubService.isEmpty());
            } else {
                subServiceMatches = (slotSubService != null && slotSubService.equalsIgnoreCase(subService));
            }
            
            if (!serviceMatches || !subServiceMatches) continue;
            
            // Check time range [time_from, time_to]
            String timeFrom = (String) slot.get("time_from");
            String timeTo = (String) slot.get("time_to");
            if (isTimeWithinRange(time, timeFrom, timeTo)) {
                vendorIds.add((String) slot.get("vendor_id"));
            }
        }

        if (vendorIds.isEmpty()) {
            return Collections.emptyList();
        }

        // Get approved vendors
        List<Map<String, Object>> approvedVendors = firestoreService.getWhereMultiple("vendors", Map.of(
            "acc_approve", "approved",
            "temp_delete", 0
        ));

        // Filter vendors by vendorIds and whether they offer serviceName/serviceBrand and workType
        return approvedVendors.stream()
                .filter(v -> {
                    String vId = (String) v.get("id");
                    if (!vendorIds.contains(vId)) return false;
                    
                    Object servicesObj = v.get("services");
                    if (!(servicesObj instanceof List)) return false;
                    List<?> servicesList = (List<?>) servicesObj;
                    for (Object sObj : servicesList) {
                        if (!(sObj instanceof Map)) continue;
                        Map<?, ?> sMap = (Map<?, ?>) sObj;
                        Object sName = sMap.get("service");
                        if (sName instanceof String) {
                            String sNameStr = (String) sName;
                            boolean matchesService = (serviceName != null && sNameStr.equalsIgnoreCase(serviceName)) ||
                                                     (serviceBrand != null && sNameStr.equalsIgnoreCase(serviceBrand));
                            if (matchesService) {
                                Object workTypesObj = sMap.get("work_types");
                                if (workTypesObj instanceof List) {
                                    List<?> wtList = (List<?>) workTypesObj;
                                    for (Object wtObj : wtList) {
                                        if (!(wtObj instanceof Map)) continue;
                                        Map<?, ?> wtMap = (Map<?, ?>) wtObj;
                                        Object wtName = wtMap.get("name");
                                        Object wtStatus = wtMap.get("status");
                                        Object wtSub = wtMap.get("subService");
                                        if (wtName instanceof String && workType != null &&
                                            ((String) wtName).equalsIgnoreCase(workType) &&
                                            "approved".equalsIgnoreCase((String) wtStatus)) {
                                            if (subService != null && !subService.isEmpty() && !"null".equalsIgnoreCase(subService)) {
                                                if (wtSub instanceof String && ((String) wtSub).equalsIgnoreCase(subService)) {
                                                    return true;
                                                }
                                            } else {
                                                return true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return false;
                })
                .toList();
    }

    private boolean isTimeWithinRange(String timeStr, String fromStr, String toStr) {
        if (timeStr == null || fromStr == null || toStr == null) return false;
        try {
            java.time.LocalTime time = parseTimeStr(timeStr);
            java.time.LocalTime from = parseTimeStr(fromStr);
            java.time.LocalTime to = parseTimeStr(toStr);
            return !time.isBefore(from) && !time.isAfter(to);
        } catch (Exception e) {
            return timeStr.compareTo(fromStr) >= 0 && timeStr.compareTo(toStr) <= 0;
        }
    }

    private java.time.LocalTime parseTimeStr(String timeStr) {
        timeStr = timeStr.trim().toUpperCase();
        if (timeStr.contains("AM") || timeStr.contains("PM")) {
            String pattern = timeStr.matches("\\d{2}:\\d{2}\\s*(AM|PM)") ? "hh:mm a" : "h:mm a";
            timeStr = timeStr.replaceAll("\\s*(AM|PM)", " $1");
            return java.time.LocalTime.parse(timeStr, java.time.format.DateTimeFormatter.ofPattern(pattern, java.util.Locale.US));
        }
        if (timeStr.length() == 5) {
            return java.time.LocalTime.parse(timeStr, java.time.format.DateTimeFormatter.ofPattern("HH:mm"));
        } else if (timeStr.length() == 8) {
            return java.time.LocalTime.parse(timeStr, java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss"));
        }
        return java.time.LocalTime.parse(timeStr);
    }
}
