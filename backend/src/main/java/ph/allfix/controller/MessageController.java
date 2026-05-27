package ph.allfix.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ph.allfix.service.FirestoreService;
import java.util.*;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final FirestoreService firestoreService;

    public MessageController(FirestoreService firestoreService) {
        this.firestoreService = firestoreService;
    }

    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<List<Map<String, Object>>> getByBooking(@PathVariable String bookingId) throws Exception {
        return ResponseEntity.ok(firestoreService.getWhere("messages", "booking_id", bookingId));
    }

    @PostMapping
    public ResponseEntity<?> send(@RequestBody Map<String, Object> body) throws Exception {
        String id = firestoreService.create("messages", body);
        return ResponseEntity.ok(Map.of("id", id, "message", "Message sent"));
    }
}
